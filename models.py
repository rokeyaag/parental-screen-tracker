from datetime import datetime, date
from sqlalchemy import (
    Column,
    Integer,
    BigInteger,
    String,
    Boolean,
    DateTime,
    Date,
    ForeignKey,
    Text,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    device_name = Column(String(100), unique=True, nullable=False)
    assigned_child = Column(String(100), nullable=True)
    os_name = Column(String(50), default="Windows")
    last_seen = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    activity_logs = relationship("ActivityLog", back_populates="device")
    screenshots = relationship("Screenshot", back_populates="device", cascade="all, delete-orphan")



class AppCategory(Base):
    __tablename__ = "app_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)
    description = Column(String(200), nullable=True)
    is_restricted_by_default = Column(Boolean, default=False)

    rules = relationship("AppRule", back_populates="category")


class AppRule(Base):
    __tablename__ = "app_rules"

    id = Column(Integer, primary_key=True, index=True)
    process_name = Column(String(100), unique=True, nullable=False, index=True)
    friendly_name = Column(String(100), nullable=True)
    category_id = Column(Integer, ForeignKey("app_categories.id"), nullable=True)
    daily_limit_minutes = Column(Integer, default=60)  # 0 means unlimited
    is_blocked = Column(Boolean, default=False)
    warning_minutes = Column(Integer, default=5)  # warn 5 minutes before limit

    category = relationship("AppCategory", back_populates="rules")


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(BigInteger, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=False)
    process_name = Column(String(100), nullable=False, index=True)
    window_title = Column(Text, nullable=True)
    category_name = Column(String(50), default="Other", index=True)
    duration_seconds = Column(Integer, default=3)
    recorded_at = Column(DateTime, default=datetime.utcnow, index=True)

    device = relationship("Device", back_populates="activity_logs")


class DailySummary(Base):
    __tablename__ = "daily_summaries"

    id = Column(Integer, primary_key=True, index=True)
    log_date = Column(Date, default=date.today, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=False)
    total_screen_time_seconds = Column(Integer, default=0)
    gaming_seconds = Column(Integer, default=0)
    study_seconds = Column(Integer, default=0)
    browsing_seconds = Column(Integer, default=0)
    other_seconds = Column(Integer, default=0)


class SystemSetting(Base):
    __tablename__ = "system_settings"

    key = Column(String(50), primary_key=True)
    value = Column(String(255), nullable=False)


class SystemAlert(Base):
    __tablename__ = "system_alerts"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=False)
    process_name = Column(String(100), nullable=True)
    alert_type = Column(String(50), nullable=False)  # 'warning', 'blocked', 'study_mode', 'emergency_lock'
    message = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class Screenshot(Base):
    __tablename__ = "screenshots"

    id = Column(BigInteger, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False)
    process_name = Column(String(100), nullable=True)
    window_title = Column(Text, nullable=True)
    category_name = Column(String(50), default="Other")
    image_data = Column(Text, nullable=False)  # Base64 JPEG data URI
    thumbnail_data = Column(Text, nullable=True)  # Small base64 thumbnail for fast UI rendering
    captured_at = Column(DateTime, default=datetime.utcnow, index=True)

    device = relationship("Device", back_populates="screenshots")


