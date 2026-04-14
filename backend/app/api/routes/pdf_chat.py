from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Form
from pathlib import Path
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_postgres import PGVector
from dotenv import load_dotenv
import os
from app.db.models import EmbeddedDocs
from sqlalchemy.orm import Session
from app.db.db import get_db
import uuid
from uuid import UUID
from fastapi.responses import StreamingResponse
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_groq import ChatGroq 
import json
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from app.utils.token_utils import check_token_limit, add_tokens
from functools import lru_cache

load_dotenv()

router = APIRouter(tags=["pdf-chat"])

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

embeddings = GoogleGenerativeAIEmbeddings(model="gemini-embedding-2-preview")
llm = ChatGroq(model="llama-3.3-70b-versatile", streaming=True)

@lru_cache(maxsize=1)
def get_vectorstore():
    return PGVector(
        embeddings=embeddings,
        collection_name="uploaded_file_data",
        connection=os.environ.get("POSTGRES_URI"),
        pre_delete_collection=False,
    )


def load_pdf(path: str):
    loader = PyPDFLoader(path)

    docs = loader.load()

    return docs


def split_docs(docs: list):
    doc_id = str(uuid.uuid4())

    for doc in docs:
        doc.metadata["doc_id"] = doc_id

    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    splits = text_splitter.split_documents(docs)

    for split in splits:
        split.metadata["doc_id"] = doc_id

    return splits, doc_id


@router.post("/upload-chat-pdf/")
async def file_upload(
    file: UploadFile = File(...),
    user_id: str = Form(...),
    db: Session = Depends(get_db),
):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    contents = await file.read()

    file_path = UPLOAD_DIR / file.filename
    with open(file_path, "wb") as f:
        f.write(contents)

    docs = load_pdf(file_path)

    splits, doc_id = split_docs(docs)

    get_vectorstore().add_documents(splits)

    Path.unlink(file_path)

    db_doc = EmbeddedDocs(doc_name=file.filename, doc_id=doc_id, user_id=user_id)
    db.add(db_doc)
    db.commit()
    db.refresh(db_doc)

    return {"message": "PDF Uploaded Successfully"}


@router.get("/get-uploaded-files/{user_id}")
async def get_files(user_id: UUID, source_type: str = "pdf", db: Session = Depends(get_db)):
    query = db.query(EmbeddedDocs).filter(EmbeddedDocs.user_id == user_id)
    if source_type:
        query = query.filter(EmbeddedDocs.source_type == source_type)
    return query.all()


@router.post("/chat-with-pdf/")
async def chat_with_pdf(
    question: str = Form(...),
    user_id: str = Form(...),
    doc_id: str = Form(...),
    db: Session = Depends(get_db),
):
    usage = check_token_limit(user_id, db)

    doc = (
        db.query(EmbeddedDocs)
        .filter(EmbeddedDocs.doc_id == doc_id, EmbeddedDocs.user_id == user_id)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    results = get_vectorstore().similarity_search(question, k=5, filter={"doc_id": doc_id})
    if not results:
        raise HTTPException(status_code=404, detail="No relevant content found")

    context = "\n\n".join([r.page_content for r in results])
    system_prompt = (
        "You are a helpful assistant. Answer the user's question using ONLY "
        "the context below. If the answer is not in the context, say so.\n\n"
        f"Context:\n{context}"
    )

    async def generate():
        total_chars = 0
        async for chunk in llm.astream([
            SystemMessage(content=system_prompt),
            HumanMessage(content=question),
        ]):
            if chunk.content:
                total_chars += len(chunk.content)
                yield f"data: {json.dumps({'content': chunk.content})}\n\n"

        estimated_tokens = (total_chars + len(question) + len(context)) // 4
        add_tokens(usage, estimated_tokens, db)
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.get("/get-uploaded-files/{user_id}")
async def get_files(user_id: UUID, db: Session = Depends(get_db)):
    files = db.query(EmbeddedDocs).filter(EmbeddedDocs.user_id == user_id).all()
    return files