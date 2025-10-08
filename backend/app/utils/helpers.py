from datetime import datetime
from typing import Any, Dict
import json

def serialize_datetime(obj: Any) -> str:
    """
    Serialize datetime objects to ISO format strings.
    
    Args:
        obj: Object to serialize
    
    Returns:
        ISO format string if datetime, otherwise str(obj)
    """
    if isinstance(obj, datetime):
        return obj.isoformat()
    return str(obj)

def safe_json_dumps(data: Dict[str, Any]) -> str:
    """
    Safely serialize dictionary to JSON, handling datetime objects.
    
    Args:
        data: Dictionary to serialize
    
    Returns:
        JSON string
    """
    return json.dumps(data, default=serialize_datetime)

def calculate_percentage_change(old_value: float, new_value: float) -> float:
    """
    Calculate percentage change between two values.
    
    Args:
        old_value: Original value
        new_value: New value
    
    Returns:
        Percentage change (positive for increase, negative for decrease)
    """
    if old_value == 0:
        return 100.0 if new_value > 0 else 0.0
    
    return ((new_value - old_value) / old_value) * 100

def format_duration(seconds: float) -> str:
    """
    Format duration in seconds to human-readable string.
    
    Args:
        seconds: Duration in seconds
    
    Returns:
        Formatted string like "2m 30s" or "1h 15m"
    """
    if seconds < 60:
        return f"{int(seconds)}s"
    elif seconds < 3600:
        minutes = int(seconds / 60)
        secs = int(seconds % 60)
        return f"{minutes}m {secs}s"
    else:
        hours = int(seconds / 3600)
        minutes = int((seconds % 3600) / 60)
        return f"{hours}h {minutes}m"