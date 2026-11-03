
"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Upload, X } from "lucide-react";
import { apiRequest } from "@/lib/api";

interface UploadSignature {
  cloud_name: string;
  api_key: string;
  timestamp: number;
  public_id: string;
  signature: string;
  allowed_formats: string;
}

interface UploadResponse {
  secure_url: string;
  public_id: string;
}

interface ConfirmResponse {
  product_id: string;
  image_url: string;
  image_public_id: string;
}

interface Props {
  productId: string;
  imageUrl: string | null;
  onUploaded: (imageUrl: string) => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export default function ProductImageUploader({
  productId,
  imageUrl,
  onUploaded,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleUpload(file?: File) {
    if (!file) return;

    setError("");
    setSuccess("");

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      setError("Only JPG, PNG and WebP images are supported.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("Image size must be 5 MB or less.");
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);
    setUploading(true);

    try {
      // Step 1: Request signed upload authorization.
      const signature = await apiRequest<UploadSignature>(
        `/products/${productId}/image/signature`,
        { method: "POST" }
      );

      // Step 2: Upload directly to Cloudinary.
      const formData = new FormData();

      formData.append("file", file);
      formData.append("api_key", signature.api_key);
      formData.append("timestamp", String(signature.timestamp));
      formData.append("public_id", signature.public_id);
      formData.append("allowed_formats", signature.allowed_formats);
      formData.append("signature", signature.signature);

      const uploadResult = await fetch(
        `https://api.cloudinary.com/v1_1/${signature.cloud_name}/image/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!uploadResult.ok) {
        throw new Error("Cloudinary image upload failed.");
      }

      const uploaded =
        (await uploadResult.json()) as UploadResponse;

      // Step 3: Ask backend to verify and save the image.
      const confirmed = await apiRequest<ConfirmResponse>(
        `/products/${productId}/image`,
        {
          method: "PUT",
          body: JSON.stringify({
            public_id: uploaded.public_id,
          }),
        }
      );

      onUploaded(confirmed.image_url);
      setSuccess("Product image uploaded successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to upload product image."
      );
    } finally {
      URL.revokeObjectURL(localPreview);
      setPreview(null);
      setUploading(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  const displayedImage = preview || imageUrl;

  return (
    <section className="w-full border border-neutral-200 bg-white p-4">
      <h3 className="font-semibold text-neutral-900">
        Product image
      </h3>

      <p className="mt-1 text-xs text-neutral-500">
        JPG, PNG or WebP. Maximum size 5 MB.
      </p>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex aspect-square w-full max-w-[180px] items-center justify-center overflow-hidden border border-neutral-200 bg-neutral-50">
          {displayedImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displayedImage}
              alt="Product preview"
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="text-center text-neutral-400">
              <ImagePlus className="mx-auto" size={30} />
              <p className="mt-2 text-xs">No image uploaded</p>
            </div>
          )}
        </div>

        <div className="flex-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={uploading}
            onChange={(event) => handleUpload(event.target.files?.[0])}
          />

          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 border border-neutral-300 px-4 py-3 text-sm font-medium hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {uploading ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <Upload size={17} />
            )}

            {uploading
              ? "Uploading..."
              : imageUrl
                ? "Replace image"
                : "Upload image"}
          </button>

          {error && (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {success && (
            <p role="status" className="mt-3 text-sm text-green-700">
              {success}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
