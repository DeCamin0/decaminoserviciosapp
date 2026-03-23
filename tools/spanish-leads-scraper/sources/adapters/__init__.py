from __future__ import annotations

from collections.abc import Callable
from typing import Any

from sources.criteria import SearchCriteria

from . import cylex as cylex_mod
from . import empresite as empresite_mod
from . import europages as europages_mod
from . import google_discovery as google_mod
from . import infobel as infobel_mod
from . import kompass as kompass_mod
from . import maps_discovery as maps_mod
from . import osm_overpass as osm_mod
from . import paginas_amarillas as pa_mod
from . import stub_sources
from . import yalwa as yalwa_mod

AdapterFn = Callable[..., Any]

ADAPTERS: dict[str, AdapterFn] = {
    "paginas_amarillas": pa_mod.run,
    "cylex": cylex_mod.run,
    "empresite": empresite_mod.run,
    "europages": europages_mod.run,
    "infobel": infobel_mod.run,
    "kompass": kompass_mod.run,
    "yalwa": yalwa_mod.run,
    "google_discovery": google_mod.run,
    "maps_discovery": maps_mod.run,
    "osm_overpass": osm_mod.run,
}
ADAPTERS.update(stub_sources.STUB_ADAPTER_BY_ID)

__all__ = ["ADAPTERS", "AdapterFn"]
