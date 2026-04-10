"""
Cache layer for well configurations.
Uses in-memory LRU cache with TTL for repeated configurations.
"""

import time
import hashlib
import json
from typing import Optional, Any, Dict
from functools import lru_cache
import logging

logger = logging.getLogger("AI_CACHE")


class ConfigCache:
    """
    In-memory cache for well configurations.
    Cache key = hash of (dn, target_height, transitions, use_reduction, warehouse, forced_top_closure_id)
    TTL = 300 seconds (5 minutes) by default
    """

    def __init__(self, ttl: int = 300, max_size: int = 500):
        self.ttl = ttl
        self.max_size = max_size
        self._store: Dict[str, Dict[str, Any]] = {}
        self._access_order: list = []

    def _make_key(self, config_data: dict) -> str:
        """
        Generates a deterministic cache key from configuration parameters.
        Only includes fields that affect the result.
        """
        key_data = {
            "dn": config_data.get("dn"),
            "target_height_mm": config_data.get("target_height_mm"),
            "use_reduction": config_data.get("use_reduction", False),
            "warehouse": config_data.get("warehouse", "KLB"),
            "forced_top_closure_id": config_data.get("forced_top_closure_id"),
            "transitions": sorted(
                [
                    {
                        "id": t.get("id"),
                        "height_from_bottom_mm": t.get("height_from_bottom_mm"),
                    }
                    for t in config_data.get("transitions", [])
                ],
                key=lambda x: x["height_from_bottom_mm"],
            ),
            "product_count": len(config_data.get("available_products", [])),
        }

        key_str = json.dumps(key_data, sort_keys=True, default=str)
        return hashlib.sha256(key_str.encode()).hexdigest()[:16]

    def get(self, config_data: dict) -> Optional[Any]:
        """Returns cached result if exists and not expired."""
        key = self._make_key(config_data)
        if key not in self._store:
            return None

        entry = self._store[key]
        if time.time() - entry["timestamp"] > self.ttl:
            del self._store[key]
            if key in self._access_order:
                self._access_order.remove(key)
            logger.debug(f"Cache MISS (expired): {key}")
            return None

        # Update access order
        if key in self._access_order:
            self._access_order.remove(key)
        self._access_order.append(key)

        logger.debug(f"Cache HIT: {key}")
        return entry["result"]

    def put(self, config_data: dict, result: Any):
        """Stores result in cache with TTL."""
        key = self._make_key(config_data)

        # Evict oldest if at capacity
        if len(self._store) >= self.max_size and key not in self._store:
            oldest_key = self._access_order.pop(0)
            if oldest_key in self._store:
                del self._store[oldest_key]
                logger.debug(f"Cache EVICT: {oldest_key}")

        self._store[key] = {
            "result": result,
            "timestamp": time.time(),
        }
        if key not in self._access_order:
            self._access_order.append(key)

        logger.debug(f"Cache SET: {key}")

    def clear(self):
        """Clears all cached entries."""
        self._store.clear()
        self._access_order.clear()
        logger.info("Cache cleared")

    @property
    def size(self) -> int:
        return len(self._store)

    @property
    def stats(self) -> dict:
        return {
            "size": len(self._store),
            "max_size": self.max_size,
            "ttl": self.ttl,
        }


# Global cache instance
cache = ConfigCache(ttl=300, max_size=500)
