import json
data=json.load(open(r"C:\Users\admin\Documents\Clients\cto\academy\data\capability-competencies.json"))
targets={"Solutions Architect":{},"AI Solutions Architect":{},"CTO / Technology Strategist":{}}
track_map={"SA":"Solutions Architect","AISA":"AI Solutions Architect","CTO":"CTO / Technology Strategist"}
for c in data["competencies"]:
    for t in c["tracks"]:
        track=track_map[t]
        # target 4 for most, 5 for importance 5
        targets[track][c["id"]]=5 if c.get("importance",3)>=5 else 4
# shared foundation targets slightly lower for SA? keep
json.dump({"targets":targets}, open(r"C:\Users\admin\Documents\Clients\cto\academy\data\capability-targets.json","w",encoding="utf-8"), indent=2)
print("done")
