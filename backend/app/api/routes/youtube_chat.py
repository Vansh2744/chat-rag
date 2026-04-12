from fastapi import APIRouter, HTTPException, Depends, Form
from fastapi.responses import StreamingResponse
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_postgres import PGVector
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_groq import ChatGroq
from langchain_core.documents import Document
from sqlalchemy.orm import Session
from app.db.db import get_db
from app.db.models import EmbeddedDocs
from dotenv import load_dotenv
import os
import uuid
import json
import re
from uuid import UUID
from pydantic import BaseModel, Field

from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import NoTranscriptFound, TranscriptsDisabled
from app.utils.token_utils import check_token_limit, add_tokens
from functools import lru_cache

load_dotenv()

router = APIRouter(tags=["chat-youtube"])

embeddings = GoogleGenerativeAIEmbeddings(model="gemini-embedding-2-preview")

@lru_cache(maxsize=1)
def get_vectorstore():
    return PGVector(
        embeddings=embeddings,
        collection_name="uploaded_file_data",
        connection=os.environ.get("POSTGRES_URI"),
        pre_delete_collection=False,
    )

llm = ChatGroq(model="llama-3.3-70b-versatile", streaming=True)


def extract_video_id(yt_url: str) -> str | None:
    patterns = [
        r"(?:v=)([A-Za-z0-9_-]{11})",
        r"(?:youtu\.be/)([A-Za-z0-9_-]{11})",
        r"(?:embed/)([A-Za-z0-9_-]{11})",
        r"(?:shorts/)([A-Za-z0-9_-]{11})",
    ]
    for p in patterns:
        m = re.search(p, yt_url)
        if m:
            return m.group(1)
    return None


def embed_youtube_video(yt_url: str, user_id: str, db: Session) -> dict:
    video_id = extract_video_id(yt_url)
    if not video_id:
        raise HTTPException(status_code=422, detail="Invalid YouTube URL — could not extract video ID.")

    ytt = YouTubeTranscriptApi()
    try:
        fetched = ytt.fetch(video_id, languages=["en", "en-US", "en-GB", "hi"])
    except NoTranscriptFound:
        try:
            tlist = ytt.list(video_id)
            transcript = tlist.find_generated_transcript(["en", "hi"])
            fetched = transcript.fetch()
        except Exception:
            raise HTTPException(
                status_code=422,
                detail="No captions found. Try a video with subtitles or auto-captions enabled.",
            )
    except TranscriptsDisabled:
        raise HTTPException(status_code=422, detail="Transcripts are disabled for this video.")
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not fetch transcript: {str(e)}")

    try:
        full_text = " ".join(snippet.text for snippet in fetched)
    except AttributeError:
        full_text = " ".join(seg["text"] for seg in fetched)
    if not full_text.strip():
        raise HTTPException(status_code=422, detail="Transcript is empty.")

    doc_id = str(uuid.uuid4())
    video_title = f"YouTube – {video_id}"

    doc = Document(
        page_content=full_text,
        metadata={
            "doc_id": doc_id,
            "source_type": "youtube",
            "user_id": user_id,
            "video_id": video_id,
        },
    )

    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    splits = splitter.split_documents([doc])
    for split in splits:
        split.metadata.update({"doc_id": doc_id, "source_type": "youtube", "user_id": user_id})

    get_vectorstore().add_documents(splits)

    db_doc = EmbeddedDocs(
        doc_name=video_title,
        doc_id=doc_id,
        user_id=user_id,
        source_type="youtube",
        source_url=yt_url,
    )
    db.add(db_doc)
    db.commit()
    db.refresh(db_doc)

    return {"doc_id": doc_id, "video_title": video_title, "video_id": video_id}


class ProcessVideoRequest(BaseModel):
    model_config = {"arbitrary_types_allowed": True}

    url: str = Field(..., description="Full YouTube video URL")
    user_id: str = Field(..., description="User UUID as string")


@router.post("/yt-chat/process-video")
async def process_video(req: ProcessVideoRequest, db: Session = Depends(get_db)):
    result = embed_youtube_video(req.url, req.user_id, db)
    return {"message": "Video processed successfully", **result}


@router.post("/yt-chat/chat")
async def chat_with_yt(
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


@router.get("/yt-chat/videos/{user_id}")
async def get_user_videos(user_id: UUID, db: Session = Depends(get_db)):
    videos = (
        db.query(EmbeddedDocs)
        .filter(
            EmbeddedDocs.user_id == user_id,
            EmbeddedDocs.source_type == "youtube",
        )
        .order_by(EmbeddedDocs.created_at.desc())
        .all()
    )
    return [
        {
            "doc_id": v.doc_id,
            "doc_name": v.doc_name,
            "source_url": v.source_url,
            "created_at": v.created_at,
        }
        for v in videos
    ]