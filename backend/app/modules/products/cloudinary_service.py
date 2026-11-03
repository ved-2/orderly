
import cloudinary
import cloudinary.utils
import cloudinary.api

from uuid import uuid4

from app.core.config import settings


def configure_cloudinary():
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True,
    )


def generate_product_upload_signature(product_id):
    configure_cloudinary()

    timestamp = int(__import__("time").time())

    public_id = (
        f"orderly/products/{product_id}/{uuid4().hex}"
    )

    params = {
        "timestamp": timestamp,
        "public_id": public_id,
        "allowed_formats": "jpg,png,webp",
    }

    signature = cloudinary.utils.api_sign_request(
        params,
        settings.CLOUDINARY_API_SECRET,
    )

    return {
        "cloud_name": settings.CLOUDINARY_CLOUD_NAME,
        "api_key": settings.CLOUDINARY_API_KEY,
        "timestamp": timestamp,
        "public_id": public_id,
        "signature": signature,
        "allowed_formats": "jpg,png,webp",
    }


def get_uploaded_product_image(public_id: str, product_id):
    configure_cloudinary()

    expected_prefix = f"orderly/products/{product_id}/"

    if not public_id.startswith(expected_prefix):
        raise ValueError("Invalid product image identifier.")

    resource = cloudinary.api.resource(
        public_id,
        resource_type="image",
    )

    if resource.get("format") not in {"jpg", "png", "webp"}:
        raise ValueError("Unsupported image format.")

    return {
        "image_url": resource["secure_url"],
        "image_public_id": resource["public_id"],
    }


def delete_cloudinary_image(public_id: str):
    configure_cloudinary()

    return cloudinary.uploader.destroy(
        public_id,
        resource_type="image",
    )
