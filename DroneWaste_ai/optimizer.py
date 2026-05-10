"""
OR-Tools CVRP solver para DroneWaste.
Adaptado de TDSE local/run.py — usa el mismo algoritmo pero acepta
el formato de contenedores de DroneWaste (status string, lng en vez de lon).
"""

import math
import time

# Demanda volumétrica en litros por estado (igual que TDSE)
DEMAND_L: dict[str, int] = {
    "VACIO":      0,
    "BAJO":       80,
    "MEDIO":      160,
    "ALTO":       240,
    "DESBORDADO": 360,
}

# Penalización por no visitar el contenedor (mayor = más urgente)
PENALTY: dict[str, int] = {
    "DESBORDADO": 1_000_000,
    "ALTO":         300_000,
    "MEDIO":        100_000,
    "BAJO":          50_000,
    "VACIO":              0,
}


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> int:
    """Distancia Haversine en metros enteros (igual que TDSE haversine_m)."""
    R = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lam = math.radians(lng2 - lng1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lam / 2) ** 2
    return int(R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))


def solve_cvrp(
    containers: list[dict],
    depot: dict,
    num_vehicles: int = 1,
    capacity_l: int = 12_000,
    time_limit_s: int = 3,
) -> dict:
    """
    Resuelve el CVRP con OR-Tools para los contenedores recibidos.

    containers : [{id, lat, lng, status, zone, name, level, ...}]
    depot      : {lat, lng}
    Retorna    : {routes, total_distance_m, total_load_l, vehicles_used, solve_seconds}
    """
    from ortools.constraint_solver import pywrapcp, routing_enums_pb2

    if not containers:
        return {"routes": [], "total_distance_m": 0, "total_load_l": 0,
                "vehicles_used": 0, "solve_seconds": 0.0}

    # Nodo 0 = depósito, nodos 1..N = contenedores
    lats = [depot["lat"]] + [c["lat"] for c in containers]
    lngs = [depot["lng"]] + [c["lng"] for c in containers]
    n    = len(lats)

    # Matriz de distancias en metros
    dist_matrix = [
        [haversine_m(lats[i], lngs[i], lats[j], lngs[j]) for j in range(n)]
        for i in range(n)
    ]

    manager = pywrapcp.RoutingIndexManager(n, num_vehicles, 0)
    routing = pywrapcp.RoutingModel(manager)

    def dist_cb(from_idx: int, to_idx: int) -> int:
        return dist_matrix[manager.IndexToNode(from_idx)][manager.IndexToNode(to_idx)]

    transit_idx = routing.RegisterTransitCallback(dist_cb)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_idx)

    # Restricción de capacidad
    demands = [0] + [DEMAND_L.get(c.get("status", "BAJO"), 80) for c in containers]

    def demand_cb(from_idx: int) -> int:
        return demands[manager.IndexToNode(from_idx)]

    demand_idx = routing.RegisterUnaryTransitCallback(demand_cb)
    routing.AddDimensionWithVehicleCapacity(
        demand_idx, 0, [capacity_l] * num_vehicles, True, "Capacity"
    )

    # Penalizaciones por no visitar (contenedor opcional con costo de omisión)
    for i, c in enumerate(containers):
        penalty = PENALTY.get(c.get("status", "BAJO"), 100_000)
        routing.AddDisjunction([manager.NodeToIndex(i + 1)], penalty)

    # Parámetros de búsqueda (igual que TDSE)
    params = pywrapcp.DefaultRoutingSearchParameters()
    params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    params.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    params.time_limit.seconds = time_limit_s

    t0       = time.monotonic()
    solution = routing.SolveWithParameters(params)
    elapsed  = time.monotonic() - t0

    if not solution:
        return {"routes": [], "total_distance_m": 0, "total_load_l": 0,
                "vehicles_used": 0, "solve_seconds": round(elapsed, 2)}

    routes     = []
    total_dist = 0
    total_load = 0

    for v in range(num_vehicles):
        idx   = routing.Start(v)
        stops = []
        r_load = 0
        r_dist = 0
        while not routing.IsEnd(idx):
            node = manager.IndexToNode(idx)
            if node != 0:
                stops.append(containers[node - 1])
                r_load += demands[node]
            next_idx = solution.Value(routing.NextVar(idx))
            r_dist  += routing.GetArcCostForVehicle(idx, next_idx, v)
            idx = next_idx
        if stops:
            routes.append({
                "vehicle":    v,
                "stops":      stops,
                "load_l":     r_load,
                "distance_m": r_dist,
            })
            total_dist += r_dist
            total_load += r_load

    return {
        "routes":           routes,
        "total_distance_m": total_dist,
        "total_load_l":     total_load,
        "vehicles_used":    len(routes),
        "solve_seconds":    round(elapsed, 2),
    }
