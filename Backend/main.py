from fastapi import FastAPI, Query, Path, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
import pandas as pd
import numpy as np
import pickle
import os
from sklearn.metrics.pairwise import cosine_similarity
import warnings
warnings.filterwarnings("ignore")

# ─────────────────────────────────────────────────────────────
#  App init
# ─────────────────────────────────────────────────────────────
app = FastAPI(
    title="LeetCode Recommender API",
    description="AI-powered LeetCode problem recommendation system",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────────
#  Load model artefacts  (adjust paths as needed)
# ─────────────────────────────────────────────────────────────
MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH  = os.path.join(MODEL_DIR, "leetcode_dataset_-_lc.csv")

def load_artifacts():
    def _pkl(name):
        return pickle.load(open(os.path.join(MODEL_DIR, name), "rb"))

    df           = _pkl("df.pkl")
    indices      = _pkl("indices.pkl")     # Series: title -> row index
    tfidf_matrix = _pkl("tfidf_matrix.pkl")
    return df, indices, tfidf_matrix

try:
    df, indices, tfidf_matrix = load_artifacts()
    print(f"✅  Loaded {len(df)} problems")
except Exception as e:
    print(f"❌  Could not load model artifacts: {e}")
    df, indices, tfidf_matrix = None, None, None

# ─────────────────────────────────────────────────────────────
#  Helper utilities
# ─────────────────────────────────────────────────────────────
def row_to_dict(row: pd.Series, idx: int) -> dict:
    """Convert a DataFrame row to a clean JSON-serialisable dict."""
    companies  = [c.strip() for c in str(row.get("companies",  "")).split(",") if c.strip()]
    topics     = [t.strip() for t in str(row.get("related_topics", "")).split(",") if t.strip()]
    return {
        "id":            int(idx) + 1,
        "title":         row.get("title", ""),
        "description":   row.get("description", ""),
        "difficulty":    row.get("difficulty", ""),
        "frequency":     float(row.get("frequency", 0) or 0),
        "url":           row.get("url", ""),
        "companies":     companies,
        "related_topics":topics,
        "likes":         int(row.get("likes", 0) or 0),
        "dislikes":      int(row.get("dislikes", 0) or 0),
        "rating":        float(row.get("rating", 0) or 0),
        "asked_by_faang":bool(int(row.get("asked_by_faang", 0) or 0)),
    }

def all_problems_list() -> List[dict]:
    return [row_to_dict(df.iloc[i], i) for i in range(len(df))]

# ─────────────────────────────────────────────────────────────
#  API Routes
# ─────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok", "total_problems": len(df) if df is not None else 0}


# ── Stats ────────────────────────────────────────────────────
@app.get("/api/stats")
def get_stats():
    if df is None:
        raise HTTPException(503, "Model not loaded")
    total   = len(df)
    easy    = int((df["difficulty"] == "Easy").sum())
    medium  = int((df["difficulty"] == "Medium").sum())
    hard    = int((df["difficulty"] == "Hard").sum())
    faang   = int(df["asked_by_faang"].sum())

    all_topics = []
    for t in df["related_topics"].dropna():
        all_topics.extend([x.strip() for x in str(t).split(",") if x.strip()])
    unique_topics = len(set(all_topics))

    all_companies = []
    for c in df["companies"].dropna():
        all_companies.extend([x.strip() for x in str(c).split(",") if x.strip()])
    unique_companies = len(set(all_companies))

    return {
        "total":            total,
        "easy":             easy,
        "medium":           medium,
        "hard":             hard,
        "faang":            faang,
        "unique_topics":    unique_topics,
        "unique_companies": unique_companies,
    }


# ── All topics ───────────────────────────────────────────────
@app.get("/api/topics")
def get_topics():
    if df is None:
        raise HTTPException(503, "Model not loaded")
    all_topics: set = set()
    for t in df["related_topics"].dropna():
        for x in str(t).split(","):
            if x.strip():
                all_topics.add(x.strip())
    return sorted(all_topics)


# ── All companies ────────────────────────────────────────────
@app.get("/api/companies")
def get_companies():
    if df is None:
        raise HTTPException(503, "Model not loaded")
    all_comp: set = set()
    for c in df["companies"].dropna():
        for x in str(c).split(","):
            if x.strip():
                all_comp.add(x.strip())
    return sorted(all_comp)


# ── Paginated + filtered problem list ────────────────────────
@app.get("/api/problems")
def get_problems(
    page:       int   = Query(1,   ge=1),
    limit:      int   = Query(20,  ge=1, le=100),
    search:     str   = Query("",  description="Search by title or topic"),
    difficulty: str   = Query("",  description="Easy | Medium | Hard"),
    topic:      str   = Query("",  description="Filter by topic"),
    company:    str   = Query("",  description="Filter by company"),
    faang_only: bool  = Query(False),
    sort_by:    str   = Query("frequency", description="frequency | likes | rating | id"),
    order:      str   = Query("desc"),
):
    if df is None:
        raise HTTPException(503, "Model not loaded")

    items = list(range(len(df)))

    # Filters
    if search:
        q = search.lower()
        items = [i for i in items if
                 q in df.iloc[i]["title"].lower() or
                 q in str(df.iloc[i]["related_topics"]).lower()]
    if difficulty:
        items = [i for i in items if df.iloc[i]["difficulty"] == difficulty]
    if topic:
        items = [i for i in items if topic.lower() in str(df.iloc[i]["related_topics"]).lower()]
    if company:
        items = [i for i in items if company.lower() in str(df.iloc[i]["companies"]).lower()]
    if faang_only:
        items = [i for i in items if int(df.iloc[i].get("asked_by_faang", 0) or 0) == 1]

    # Sort
    valid_sorts = {"frequency", "likes", "rating", "id"}
    if sort_by not in valid_sorts:
        sort_by = "frequency"
    reverse = order != "asc"
    if sort_by == "id":
        items.sort(key=lambda i: i, reverse=reverse)
    else:
        items.sort(key=lambda i: float(df.iloc[i].get(sort_by, 0) or 0), reverse=reverse)

    total      = len(items)
    pages      = max(1, -(-total // limit))
    start      = (page - 1) * limit
    chunk      = items[start: start + limit]
    data       = [row_to_dict(df.iloc[i], i) for i in chunk]

    return {
        "data":        data,
        "total":       total,
        "page":        page,
        "limit":       limit,
        "total_pages": pages,
        "has_next":    page < pages,
        "has_prev":    page > 1,
    }


# ── Top N problems ───────────────────────────────────────────
@app.get("/api/top")
def get_top(
    n:          int  = Query(10, ge=1, le=50),
    metric:     str  = Query("frequency", description="frequency | likes | rating"),
    difficulty: str  = Query(""),
    faang_only: bool = Query(False),
):
    if df is None:
        raise HTTPException(503, "Model not loaded")

    valid = {"frequency", "likes", "rating"}
    if metric not in valid:
        raise HTTPException(400, f"metric must be one of {valid}")

    items = list(range(len(df)))
    if difficulty:
        items = [i for i in items if df.iloc[i]["difficulty"] == difficulty]
    if faang_only:
        items = [i for i in items if int(df.iloc[i].get("asked_by_faang", 0) or 0) == 1]

    items.sort(key=lambda i: float(df.iloc[i].get(metric, 0) or 0), reverse=True)
    data = [row_to_dict(df.iloc[i], i) for i in items[:n]]
    return {"metric": metric, "count": len(data), "data": data}


# ── Single problem ───────────────────────────────────────────
@app.get("/api/problems/{problem_id}")
def get_problem(problem_id: int = Path(..., ge=1)):
    if df is None:
        raise HTTPException(503, "Model not loaded")
    idx = problem_id - 1
    if idx >= len(df):
        raise HTTPException(404, "Problem not found")
    return row_to_dict(df.iloc[idx], idx)


# ── Recommendations ──────────────────────────────────────────
@app.get("/api/recommend/{problem_id}")
def get_recommendations(
    problem_id: int = Path(..., ge=1),
    n:          int = Query(10, ge=1, le=30),
):
    if df is None or tfidf_matrix is None:
        raise HTTPException(503, "Model not loaded")

    idx = problem_id - 1
    if idx >= len(df):
        raise HTTPException(404, "Problem not found")

    row       = df.iloc[idx]
    title     = row["title"]
    sim_row   = cosine_similarity(tfidf_matrix[idx:idx+1], tfidf_matrix)[0]
    sim_scores = sorted(enumerate(sim_row), key=lambda x: x[1], reverse=True)
    sim_scores = [(i, float(s)) for i, s in sim_scores if i != idx][:n]

    data = []
    for i, score in sim_scores:
        problem = row_to_dict(df.iloc[i], i)
        problem["similarity_score"] = round(score, 4)
        data.append(problem)

    return {
        "source_problem": {"id": problem_id, "title": title},
        "recommendations": data,
    }


# ── Search by title (autocomplete) ───────────────────────────
@app.get("/api/search")
def search_problems(
    q:     str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=20),
):
    if df is None:
        raise HTTPException(503, "Model not loaded")
    ql = q.lower()
    results = []
    for i in range(len(df)):
        if ql in df.iloc[i]["title"].lower():
            results.append({"id": i + 1, "title": df.iloc[i]["title"], "difficulty": df.iloc[i]["difficulty"]})
        if len(results) >= limit:
            break
    return results


# ── Topic stats (for charts) ─────────────────────────────────
@app.get("/api/topic_stats")
def topic_stats(top_n: int = Query(10, ge=1, le=30)):
    if df is None:
        raise HTTPException(503, "Model not loaded")
    from collections import Counter
    counter: Counter = Counter()
    for t in df["related_topics"].dropna():
        for x in str(t).split(","):
            if x.strip():
                counter[x.strip()] += 1
    top = counter.most_common(top_n)
    return [{"topic": t, "count": c} for t, c in top]
