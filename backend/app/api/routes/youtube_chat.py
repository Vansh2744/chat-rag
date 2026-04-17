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
from functools import lru_cache
from pydantic import BaseModel, Field
from uuid import UUID
import os, uuid, json, re

from youtube_transcript_api import (
    YouTubeTranscriptApi,
    NoTranscriptFound,
    TranscriptsDisabled,
    RequestBlocked,
    IpBlocked,
)
from youtube_transcript_api.proxies import WebshareProxyConfig

load_dotenv()
router = APIRouter(tags=["chat-youtube"])


def require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise HTTPException(status_code=500, detail=f"Missing environment variable: {name}")
    return value


def get_postgres_uri() -> str:
    uri = os.getenv("POSTGRES_URI") or os.getenv("DATABASE_URL")
    if not uri:
        raise HTTPException(status_code=500, detail="Missing POSTGRES_URI / DATABASE_URL")

    if uri.startswith("postgres://"):
        uri = uri.replace("postgres://", "postgresql+psycopg://", 1)
    elif uri.startswith("postgresql://") and not uri.startswith("postgresql+psycopg://"):
        uri = uri.replace("postgresql://", "postgresql+psycopg://", 1)

    if os.getenv("RENDER") == "true" and "sslmode=" not in uri:
        uri += "&sslmode=require" if "?" in uri else "?sslmode=require"

    return uri


@lru_cache(maxsize=1)
def get_embeddings():
    require_env("GOOGLE_API_KEY")
    return GoogleGenerativeAIEmbeddings(model="gemini-embedding-001")


@lru_cache(maxsize=1)
def get_llm():
    require_env("GROQ_API_KEY")
    return ChatGroq(model="llama-3.3-70b-versatile", streaming=True)


@lru_cache(maxsize=1)
def get_vectorstore():
    return PGVector(
        embeddings=get_embeddings(),
        collection_name="uploaded_file_data",
        connection=get_postgres_uri(),
        pre_delete_collection=False,
        create_extension=False,
    )


@lru_cache(maxsize=1)
def get_youtube_client():
    proxy_user = os.getenv("WEBSHARE_PROXY_USERNAME")
    proxy_pass = os.getenv("WEBSHARE_PROXY_PASSWORD")

    if proxy_user and proxy_pass:
        return YouTubeTranscriptApi(
            proxy_config=WebshareProxyConfig(
                proxy_username=proxy_user,
                proxy_password=proxy_pass,
            )
        )

    return YouTubeTranscriptApi()


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
        raise HTTPException(status_code=422, detail="Invalid YouTube URL")

    ytt = get_youtube_client()

    try:
        fetched = ytt.fetch(video_id, languages=["en", "en-US", "en-GB", "hi"])
    except NoTranscriptFound:
        try:
            transcript = ytt.list(video_id).find_generated_transcript(["en", "hi"])
            fetched = transcript.fetch()
        except NoTranscriptFound:
            raise HTTPException(status_code=422, detail="No captions found for this video.")
    except TranscriptsDisabled:
        raise HTTPException(status_code=422, detail="Transcripts are disabled for this video.")
    except (RequestBlocked, IpBlocked):
        raise HTTPException(
            status_code=503,
            detail="YouTube blocked the Render server IP. Configure a rotating residential proxy.",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcript fetch failed: {str(e)}")

    full_text = " ".join(snippet.text for snippet in fetched).strip()
    if not full_text:
        raise HTTPException(status_code=422, detail="Transcript is empty.")

    doc_id = str(uuid.uuid4())
    doc = Document(
        page_content=full_text,
        metadata={"doc_id": doc_id, "source_type": "youtube", "user_id": user_id, "video_id": video_id},
    )

    splits = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200).split_documents([doc])
    for split in splits:
        split.metadata.update({"doc_id": doc_id, "source_type": "youtube", "user_id": user_id})

    get_vectorstore().add_documents(splits)
    return {"doc_id": doc_id, "video_title": f"YouTube - {video_id}", "video_id": video_id}
