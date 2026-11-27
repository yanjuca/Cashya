from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.serialization import envelope
from app.models.user import User
from app.schemas.sync import BackupPayload, SyncBatchRequest
from app.services.sync import export_backup, import_backup, process_batch

router = APIRouter()


@router.post("/batch", summary="Push offline mutations and pull server changes (Last-Write-Wins)")
def sync_batch(payload: SyncBatchRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    return envelope(process_batch(db, user, payload))


@router.post("/import-backup", summary="Import the JSON backup exported by the mobile app")
def sync_import_backup(payload: BackupPayload, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    return envelope(import_backup(db, user, payload), "Backup imported successfully")


@router.get("/export-backup", summary="Download the account data in the BackupData JSON format")
def sync_export_backup(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    return envelope(export_backup(db, user))
