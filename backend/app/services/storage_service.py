# Cloudflare R2 storage via the S3-compatible API. Bucket is private —
# nothing is served by direct URL. Callers store the returned object key,
# then call get_presigned_url(key) at read time to hand out a short-lived,
# access-checked download link.
import base64
import uuid

import boto3
from botocore.config import Config

from app.core.config import settings

_client = boto3.client(
    "s3",
    endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
    aws_access_key_id=settings.R2_ACCESS_KEY_ID,
    aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
    config=Config(signature_version="s3v4"),
    region_name="auto",
)

BUCKET = settings.R2_BUCKET_NAME


def _content_type_for(extension: str) -> str:
    return "application/pdf" if extension == "pdf" else f"image/{extension}"


def _upload(file_bytes: bytes, key: str, extension: str) -> str:
    _client.put_object(Bucket=BUCKET, Key=key, Body=file_bytes, ContentType=_content_type_for(extension))
    return key


def save_base64_file(base64_data: str, filename_prefix: str, extension: str) -> str:
    if "," in base64_data:
        base64_data = base64_data.split(",", 1)[1]
    file_bytes = base64.b64decode(base64_data)
    key = f"{filename_prefix}_{uuid.uuid4().hex}.{extension}"
    return _upload(file_bytes, key, extension)


def save_bytes_file(file_bytes: bytes, filename_prefix: str, extension: str) -> str:
    key = f"{filename_prefix}_{uuid.uuid4().hex}.{extension}"
    return _upload(file_bytes, key, extension)


def download_bytes(key: str) -> bytes:
    obj = _client.get_object(Bucket=BUCKET, Key=key)
    return obj["Body"].read()


def get_presigned_url(key: str, expires_in: int = 3600) -> str:
    return _client.generate_presigned_url(
        "get_object", Params={"Bucket": BUCKET, "Key": key}, ExpiresIn=expires_in
    )