from cryptography.fernet import Fernet, InvalidToken

from app.config import settings

_fernet: Fernet | None = None


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        if not settings.app_encryption_key:
            raise RuntimeError(
                "APP_ENCRYPTION_KEY is not set; cannot encrypt/decrypt OMS endpoint credentials"
            )
        _fernet = Fernet(settings.app_encryption_key.encode())
    return _fernet


def encrypt_password(plain: str) -> str:
    return _get_fernet().encrypt(plain.encode()).decode()


def decrypt_password(ciphertext: str) -> str:
    try:
        return _get_fernet().decrypt(ciphertext.encode()).decode()
    except InvalidToken as exc:
        raise RuntimeError(
            "Failed to decrypt OMS endpoint password — check APP_ENCRYPTION_KEY"
        ) from exc
