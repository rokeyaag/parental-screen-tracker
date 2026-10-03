import sys
from tracker.client import TrackerClient

if __name__ == "__main__":
    print(f"=====================================================")
    print(f"  Parental Screen Tracker - Activity Monitor & Enforcer")
    print(f"=====================================================")
    client = TrackerClient()
    try:
        client.start()
    except KeyboardInterrupt:
        client.stop()
