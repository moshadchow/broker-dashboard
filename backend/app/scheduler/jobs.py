import logging
from datetime import datetime

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.config import settings
from app.services.pipeline import run_pipeline

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler(timezone=settings.app_timezone)

DAILY_JOB_ID = "daily_pipeline"

VALID_WEEKDAYS = {"mon", "tue", "wed", "thu", "fri", "sat", "sun"}


def normalize_scheduled_days(scheduled_days: str) -> str:
    days = [day.strip().lower() for day in scheduled_days.split(",") if day.strip()]
    invalid_days = [day for day in days if day not in VALID_WEEKDAYS]

    if not days:
        raise ValueError("scheduled_days must include at least one weekday")
    if invalid_days:
        valid = ", ".join(sorted(VALID_WEEKDAYS))
        invalid = ", ".join(invalid_days)
        raise ValueError(f"invalid scheduled_days value(s): {invalid}. Valid values: {valid}")

    return ",".join(days)


def build_daily_trigger() -> CronTrigger:
    hour, minute = (int(part) for part in settings.scheduled_time.split(":"))
    scheduled_days = normalize_scheduled_days(settings.scheduled_days)
    return CronTrigger(
        day_of_week=scheduled_days,
        hour=hour,
        minute=minute,
        timezone=settings.app_timezone,
    )


def start_scheduler() -> None:
    scheduled_days = normalize_scheduled_days(settings.scheduled_days)

    scheduler.add_job(
        run_pipeline,
        trigger=build_daily_trigger(),
        id=DAILY_JOB_ID,
        replace_existing=True,
        # No misfire catch-up: "startup_run" below already covers a fresh
        # fetch after a restart, so a missed daily slot should be skipped
        # rather than fired again on top of it.
        misfire_grace_time=None,
    )

    # Run once immediately on startup. REMOVE this line if you don't want this run on every restart (e.g. if you only want the daily scheduled runs).
    scheduler.add_job(run_pipeline, id="startup_run", next_run_time=datetime.now())

    scheduler.start()
    logger.info(
        "scheduler started: daily run at %s (%s), days=%s",
        settings.scheduled_time,
        settings.app_timezone,
        scheduled_days,
    )


def stop_scheduler() -> None:
    scheduler.shutdown(wait=False)
