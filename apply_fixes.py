import os

def replace_in_file(filepath, target, replacement):
    with open(filepath, 'r') as f:
        content = f.read()
    if target in content:
        new_content = content.replace(target, replacement)
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Successfully replaced '{target}' with '{replacement}'")
    else:
        print(f"Target '{target}' not found")

filepath = 'src/App.tsx'

# 1. Update map source
replace_in_file(filepath, 
                '            {members.map((member, idx) => (', 
                '            {sortedMembers.map((member, idx) => (')

# 2. Update points display
replace_in_file(filepath,
                '                        {member.totalWorkouts || 0} pts',
                '                        { (group.startDate && group.endDate) ? (challengeStats[member.uid] || 0) : (member.totalWorkouts || 0) } pts')

# 3. Add calendar button
target_header = '<Button variant="danger" size="icon" onClick={leaveGroup} className="w-10 h-10 border-none bg-transparent hover:bg-red-500/10"><LogOut size={18} /></Button>\n               </div>'
replacement_header = '<Button variant="danger" size="icon" onClick={leaveGroup} className="w-10 h-10 border-none bg-transparent hover:bg-red-500/10"><LogOut size={18} /></Button>\n               {currentUser.uid === group.creatorId && (\n                 <Button \n                   variant="ghost" \n                   size="icon" \n                   onClick={() => setShowConfig(!showConfig)}\n                   className="w-10 h-10 bg-white/5 border border-white/10 hover:bg-white/10 ml-2"\n                 >\n                   <Calendar size={18} className="text-brand-primary" />\n                 </Button>\n               )}\n            </div>'

# Note: The above replacement_header has different indentation, let's try a simpler target for the header.
replace_in_file(filepath,
                '<LogOut size={18} /></Button>',
                '<LogOut size={18} /></Button>\n               {currentUser.uid === group.creatorId && (\n                 <Button variant="ghost" size="icon" onClick={() => setShowConfig(!showConfig)} className="ml-2 w-10 h-10 bg-white/5 border border-white/10"><Calendar size={18} className="text-brand-primary" /></Button>\n               )}')
