import logging
from typing import Iterable

from exponent_server_sdk import (
    DeviceNotRegisteredError,
    PushClient,
    PushMessage,
    PushServerError,
    PushTicketError,
)
from requests.exceptions import ConnectionError, HTTPError

logger = logging.getLogger(__name__)


def send_push_notifications(tokens: Iterable[str], title: str, body: str, data: dict | None = None) -> None:
    """Send Expo push notifications. iOS testing needs a paid Apple Developer account; Android works via Expo."""
    messages = [
        PushMessage(to=token, title=title, body=body, data=data or {}, sound="default")
        for token in tokens
        if token
    ]
    if not messages:
        return

    client = PushClient()
    try:
        tickets = client.publish_multiple(messages)
    except PushServerError as exc:
        logger.error("Expo push server error: %s", exc)
        return
    except (ConnectionError, HTTPError) as exc:
        logger.error("Expo push network error: %s", exc)
        return

    for ticket in tickets:
        try:
            if ticket.status == "error":
                if ticket.details and ticket.details.get("error") == "DeviceNotRegistered":
                    raise DeviceNotRegisteredError(ticket.message)
                raise PushTicketError(ticket.message)
        except (DeviceNotRegisteredError, PushTicketError) as exc:
            logger.warning("Push ticket issue: %s", exc)
