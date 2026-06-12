import logging
from datetime import datetime

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.config import settings
from app.services.pipeline import run_pipeline

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler(timezone=settings.app_timezone)

DAILY_JOB_ID = "daily_pipeline"


def start_scheduler() -> None:
    hour, minute = (int(part) for part in settings.scheduled_time.split(":"))

    scheduler.add_job(
        run_pipeline,
        trigger=CronTrigger(hour=hour, minute=minute, timezone=settings.app_timezone),
        id=DAILY_JOB_ID,
        replace_existing=True,
        # No misfire catch-up: "startup_run" below already covers a fresh
        # fetch after a restart, so a missed daily slot should be skipped
        # rather than fired again on top of it.
        misfire_grace_time=None,
    )

    # Run once immediately on startup.
    scheduler.add_job(run_pipeline, id="startup_run", next_run_time=datetime.now())

    scheduler.start()
    logger.info("scheduler started: daily run at %s (%s)", settings.scheduled_time, settings.app_timezone)


def stop_scheduler() -> None:
    scheduler.shutdown(wait=False)
