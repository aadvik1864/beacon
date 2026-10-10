"""Bounded process-local records and idempotency. Nothing is written to disk."""

import hashlib
import threading
import time
from collections import OrderedDict, deque

from beacon.models import RunRecord, SimulationInput
from beacon.simulation import simulate


class RunConflict(Exception):
    pass


class RunBusy(Exception):
    pass


class RunRepository:
    def __init__(self, capacity: int = 20, rate_limit: int = 30):
        self.capacity = capacity
        self.rate_limit = rate_limit
        self._lock = threading.Lock()
        self._records: OrderedDict[str, tuple[str, float, RunRecord]] = OrderedDict()
        self._timestamps: deque[float] = deque()

    def execute(self, request: SimulationInput) -> RunRecord:
        if not self._lock.acquire(blocking=False):
            raise RunBusy("Another simulation is running. Try again after it finishes.")
        try:
            now = time.monotonic()
            for key in list(self._records):
                if now - self._records[key][1] > 1800:
                    del self._records[key]
            fingerprint = hashlib.sha256(request.model_dump_json(exclude={"idempotency_key"}).encode()).hexdigest()
            existing = self._records.get(request.idempotency_key)
            if existing:
                if existing[0] != fingerprint:
                    raise RunConflict("This request identifier was already used with different inputs.")
                return existing[2].model_copy(deep=True)
            while self._timestamps and now - self._timestamps[0] >= 60:
                self._timestamps.popleft()
            if len(self._timestamps) >= self.rate_limit:
                raise RunBusy("Local simulation limit reached. Wait a minute before trying again.")
            self._timestamps.append(now)
            record = simulate(request)
            self._records[request.idempotency_key] = (fingerprint, now, record)
            while len(self._records) > self.capacity:
                self._records.popitem(last=False)
            return record.model_copy(deep=True)
        finally:
            self._lock.release()
