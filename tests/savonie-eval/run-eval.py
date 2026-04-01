#!/usr/bin/env python3
"""Savonie 200-question evaluation runner against live endpoint."""
import json, time, sys, urllib.request, urllib.error

ENDPOINT = "https://portfolio-chat.eayramia.workers.dev/chat"
EVAL_FILE = "tests/savonie-eval/savonie-200-eval.json"
RESULTS_FILE = "tests/savonie-eval/eval-results.json"

def ask_savonie(question, page="/", history=None):
    """Send a question to the live Savonie endpoint."""
    payload = {"message": question, "page": page, "language": "en"}
    if history:
        payload["history"] = history
    data = json.dumps(payload).encode()
    req = urllib.request.Request(ENDPOINT, data=data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read())
            return result.get("reply", "")
    except Exception as e:
        return f"ERROR: {e}"

def score_answer(answer, q_data):
    """Score an answer against must/mustNot criteria."""
    answer_lower = answer.lower()
    score = {"factuality": 1, "usefulness": 1, "directness": 1, "honesty": 1, "total": 0}
    failures = []
    
    # Check "must" patterns
    must_pass = 0
    must_total = len(q_data.get("must", []))
    for m in q_data.get("must", []):
        if m.lower() in answer_lower:
            must_pass += 1
        else:
            failures.append(f"MISSING: '{m}'")
    
    # Check "mustNot" patterns
    must_not_fails = 0
    for mn in q_data.get("mustNot", []):
        if mn.lower() in answer_lower:
            must_not_fails += 1
            failures.append(f"CONTAINS_BANNED: '{mn}'")
    
    # Calculate score (0-100)
    must_score = (must_pass / must_total * 70) if must_total > 0 else 70
    not_penalty = must_not_fails * 20
    score["total"] = max(0, min(100, must_score + 30 - not_penalty))
    
    # Directness check: does it start with substance or a redirect?
    if answer_lower.startswith(("the best place", "you can find", "check out", "head to", "go to")):
        score["directness"] = 0
        failures.append("REDIRECT_FIRST")
        score["total"] = max(0, score["total"] - 15)
    
    # Length check: too short = probably deflecting
    if len(answer) < 30:
        score["usefulness"] = 0
        failures.append("TOO_SHORT")
        score["total"] = max(0, score["total"] - 10)
    
    # Error check
    if answer.startswith("ERROR:"):
        score["total"] = 0
        failures.append("API_ERROR")
    
    return score, failures

def main():
    with open(EVAL_FILE) as f:
        eval_data = json.load(f)
    
    results = {"timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"), "categories": [], "summary": {}}
    total_questions = 0
    total_score = 0
    all_failures = {}
    category_scores = []
    
    for cat in eval_data["categories"]:
        cat_name = cat["name"]
        cat_results = {"name": cat_name, "questions": [], "avg_score": 0}
        cat_total = 0
        cat_score_sum = 0
        
        for q_data in cat["questions"]:
            q = q_data["q"]
            # Handle follow-up chain format
            if " → " in q:
                parts = q.split(" → ")
                q = parts[0]  # Just test the first question for now
            
            total_questions += 1
            cat_total += 1
            
            # Rate limit: 1 request per 1.5 seconds
            time.sleep(1.5)
            
            answer = ask_savonie(q)
            score, failures = score_answer(answer, q_data)
            
            cat_score_sum += score["total"]
            total_score += score["total"]
            
            # Track failure patterns
            for f in failures:
                pattern = f.split(":")[0]
                all_failures[pattern] = all_failures.get(pattern, 0) + 1
            
            result = {
                "question": q,
                "intent": q_data.get("intent", ""),
                "answer_preview": answer[:200],
                "score": score["total"],
                "failures": failures,
                "pass": score["total"] >= 60
            }
            cat_results["questions"].append(result)
            
            # Progress output
            status = "PASS" if result["pass"] else "FAIL"
            print(f"  [{status}] ({score['total']:3d}) {q[:60]}", flush=True)
        
        cat_results["avg_score"] = round(cat_score_sum / cat_total, 1) if cat_total > 0 else 0
        results["categories"].append(cat_results)
        category_scores.append((cat_name, cat_results["avg_score"]))
        print(f"\n  >> {cat_name}: {cat_results['avg_score']}/100 avg\n", flush=True)
    
    # Summary
    avg_score = round(total_score / total_questions, 1) if total_questions > 0 else 0
    pass_count = sum(1 for cat in results["categories"] for q in cat["questions"] if q["pass"])
    fail_count = total_questions - pass_count
    
    results["summary"] = {
        "total_questions": total_questions,
        "avg_score": avg_score,
        "pass_count": pass_count,
        "fail_count": fail_count,
        "pass_rate": round(pass_count / total_questions * 100, 1),
        "failure_patterns": dict(sorted(all_failures.items(), key=lambda x: -x[1])),
        "weakest_categories": sorted(category_scores, key=lambda x: x[1])[:5],
        "strongest_categories": sorted(category_scores, key=lambda x: -x[1])[:5]
    }
    
    with open(RESULTS_FILE, "w") as f:
        json.dump(results, f, indent=2)
    
    print(f"\n{'='*60}")
    print(f"SAVONIE EVAL RESULTS")
    print(f"{'='*60}")
    print(f"Total questions: {total_questions}")
    print(f"Average score:   {avg_score}/100")
    print(f"Pass rate:       {results['summary']['pass_rate']}%")
    print(f"Passes:          {pass_count}")
    print(f"Failures:        {fail_count}")
    print(f"\nFailure patterns:")
    for pattern, count in sorted(all_failures.items(), key=lambda x: -x[1]):
        print(f"  {pattern}: {count}")
    print(f"\nWeakest categories:")
    for name, score in sorted(category_scores, key=lambda x: x[1])[:5]:
        print(f"  {name}: {score}/100")
    print(f"\nStrongest categories:")
    for name, score in sorted(category_scores, key=lambda x: -x[1])[:5]:
        print(f"  {name}: {score}/100")
    
    return avg_score

if __name__ == "__main__":
    main()
