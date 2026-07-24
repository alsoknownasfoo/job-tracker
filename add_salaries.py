import re
import json

salaries = {
    "Zoox": "$230k - $280k",
    "OpenAI": "$250k - $320k",
    "Microsoft": "$200k - $270k",
    "Walmart": "$210k - $260k",
    "Adobe": "$220k - $270k",
    "Skydio": "$180k - $230k",
    "Microsoft AI": "$210k - $280k",
    "World": "$180k - $240k",
    "Logitech": "$170k - $220k",
    "Bloomberg": "$200k - $260k",
    "Grindr": "$210k - $250k",
    "Duolingo": "$220k - $260k",
    "Anthropic": "$240k - $300k",
    "Intuit": "$230k - $280k"
}

with open('/Users/foo/Desktop/JobTracker/data.js', 'r') as f:
    content = f.read()

# We want to insert `salary: "...",` before `status: "to_apply"`
def repl(m):
    company_name = m.group(1)
    
    # Try to find the company name in our dict
    salary = "$180k - $250k" # default
    for k, v in salaries.items():
        if k in company_name:
            salary = v
            break
            
    # Now insert salary right before status
    # group 0 is the whole match
    # m.group(2) is everything up to the status line
    return f'company: "{company_name}",{m.group(2)}salary: "{salary}",\n    status:'

new_content = re.sub(r'company:\s*"([^"]+)",(.*?)(?=\bstatus:)', repl, content, flags=re.DOTALL)

with open('/Users/foo/Desktop/JobTracker/data.js', 'w') as f:
    f.write(new_content)

print("done")
