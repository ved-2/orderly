from pathlib import Path

import firebase_admin
from firebase_admin import credentials

from app.core.config import settings


def get_firebase_app():
    try:
        return firebase_admin.get_app()
    except ValueError:
        credential_path = Path(
            settings.FIREBASE_SERVICE_ACCOUNT_PATH
        )

        if not credential_path.is_absolute():
            credential_path = Path.cwd() / credential_path

        if not credential_path.is_file():
            raise RuntimeError(
                "Firebase service account credentials not found."
            )

        credential = credentials.Certificate(str(credential_path))

        return firebase_admin.initialize_app(credential)