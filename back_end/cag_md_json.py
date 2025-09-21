import os
import json
import re
from fuzzywuzzy import fuzz

# --- Configuration ---
DATA_DIR = "/home/Comptroller_and_Auditor_General/TN_35_md"
OUTPUT_DIR = "/home/Comptroller_and_Auditor_General/TN_35_json"

# --- Budget Heading Patterns ---
budget_heading_patterns = [
    r"BUDGET\s*/?\s*FINANCIAL\s+PERFORMANCE",
    r"FINANCIAL\s+PERFORMANCE",
    r"BUDGET\s+PERFORMANCE", 
    r"BUDGET\s+AND\s+FINANCIAL\s+PERFORMANCE",
    r"c\)\s*Budget\s+and\s+Financial\s+Performance",
    r"^\s*c\)\s*Budget",
    r"Financial\s+Performance:",
    r"Budget\s+and\s+Financial\s+Performance:",
    r"Budget\s+allocation\s+for\s+the\s+audit\s+period:",
    r"^\s*Financial\s+Performance\s*:",
    r"^\s*Budget\s+and\s+Financial\s+Performance\s*:",
    r"^\s*Budget\s+allocation\s+for\s+the\s+audit\s+period\s*:",
    r"^\s*\d+\.\d+\s+Financial\s+Performance\s*:",
    r"^\s*\d+\.\d+\s*\t+Financial\s+Performance\s*:",
    r"\d+\.\d+\s*Financial\s+Performance:",
    r"\d+\.\d+\s*\t+Financial\s+Performance:",
    r"\d+\.\d+\s+Financial\s+Performance:",
    r"Financial\s+Performance",
    r"\d+\.\d+.*Financial\s+Performance"
]

# --- Audit Objective Patterns ---
objective_patterns = [
    r"Audit\s+objectives",
    r"AUDIT\s+OBJECTIVE", 
    r"Audit\s+objective",
    r"AUDIT\s+OBJECTIVE:",
    r"Audit\s+Objective:",
    r"\d+\.\d+\s+Audit\s+objectives:",
    r"Audit\s+objectives:"
]

# --- Audit Criteria Patterns ---
criteria_patterns = [
    r"Audit\s+Criteria",
    r"AUDIT\s+CRITERIA",
    r"Audit\s+criteria:",
    r"Audit\s+criteria",
    r"Audit\s+criteria\s+were\s+adopted\s+from\s+the\s+following\s+sources:",
    r"Audit\s+criteria\s+were\s+adopted",
    r"criteria\s+were\s+adopted\s+from"
]

# --- Helper Functions ---
def table_to_html(table_lines):
    """Converts a markdown table (list of strings) to an HTML string preserving exact structure."""
    # Check if it's already HTML table content
    if any('<table>' in line or '<tr>' in line or '<td>' in line or '<th>' in line for line in table_lines):
        # Return exact HTML structure but remove newlines
        return ''.join(table_lines).replace('\n', '')
    
    # For markdown tables, convert to HTML
    html = "<table>"
    for i, line in enumerate(table_lines):
        cells = [cell.strip() for cell in line.strip().strip('|').split('|')]
        tag = "td"
        html += "<tr>"
        for cell in cells:
            html += f"<{tag}>{cell}</{tag}>"
        html += "</tr>"
    html += "</table>"
    return html

def extract_budget_allocation_from_part_i(lines):
    """
    Extract budget/allocation content from Part I sections using budget heading patterns.
    Returns a list of content objects with type and text/table properties.
    """
    budget_content = []
    
    # Find Part I boundaries
    part_i_start = None
    part_i_end = None
    
    for i, line in enumerate(lines):
        line_stripped = line.strip()
        line_lower = line_stripped.lower()
        
        # Look for Part I heading (must be a proper heading with ##)
        if line_stripped.startswith('##') and 'part' in line_lower:
            if (('i' in line_lower and 'ii' not in line_lower) or 
                ('1' in line_stripped and '2' not in line_stripped)) and not part_i_start:
                part_i_start = i
        elif part_i_start and line_stripped.startswith('##') and 'part' in line_lower:
            if ('ii' in line_lower or '2' in line_stripped):
                part_i_end = i
                break
    
    if not part_i_start:
        return budget_content
    
    if not part_i_end:
        part_i_end = len(lines)
    
    # Look for budget headings in Part I
    i = part_i_start
    while i < part_i_end:
        line = lines[i].strip()
        
        # Check if line is a #### heading that matches budget patterns
        is_budget_heading = False
        heading_text = ""
        
        if line.startswith('#### '):
            heading_text = line[5:].strip()
        elif line.startswith('###'):
            heading_text = line[3:].strip()
        elif line.startswith('##'):
            heading_text = line[2:].strip()
        else:
            # Check for other patterns like " 1.2 Financial Performance:" or numbered sections
            heading_text = line
        
        # Check if this heading matches any budget pattern
        for pattern in budget_heading_patterns:
            if re.search(pattern, heading_text, re.IGNORECASE):
                is_budget_heading = True
                break
        
        if is_budget_heading:
            # Found a budget heading, extract content until next #### or numbered section or end of Part I
            i += 1
            while i < part_i_end:
                content_line = lines[i].strip()
                
                # Stop if we hit another #### heading or numbered section pattern
                if (content_line.startswith('#### ') or 
                    content_line.startswith('### ') or
                    content_line.startswith('## ') or
                    re.match(r'^\s*\d+\.\d+', content_line)):
                    break
                
                # Skip empty lines
                if not content_line:
                    i += 1
                    continue
                
                # Handle tables
                if '|' in content_line:
                    table_lines = []
                    table_start = i
                    while i < part_i_end and '|' in lines[i]:
                        if not re.match(r'^\s*\|(?:\s*:?---:?.*\|)+\s*$', lines[i]):
                            table_lines.append(lines[i])
                        i += 1
                    
                    if table_lines:
                        html_table = table_to_html(table_lines)
                        budget_content.append({"type": "table", "table": html_table})
                    continue
                
                # Handle HTML tables
                elif '<table>' in content_line:
                    table_lines = [content_line]
                    table_open = content_line.count('<table>')
                    table_close = content_line.count('</table>')
                    i += 1
                    while i < part_i_end:
                        table_open += lines[i].count('<table>')
                        table_close += lines[i].count('</table>')
                        table_lines.append(lines[i])
                        if table_open > 0 and table_open == table_close:
                            i += 1
                            break
                        i += 1
                    
                    # Preserve exact HTML table structure but remove newlines
                    html_table = ''.join(table_lines).replace('\n', '')
                    budget_content.append({"type": "table", "table": html_table})
                    continue
                
                # Handle paragraphs
                else:
                    budget_content.append({"type": "paragraph", "text": content_line})
                    i += 1
                    continue
        
        i += 1
    
    return budget_content

def extract_audit_objective_from_part_i(lines):
    """
    Extract audit objective content from Part I sections using objective heading patterns.
    Returns an array of objects with type and text properties.
    """
    objective_content = []
    
    # Find Part I boundaries
    part_i_start = None
    part_i_end = None
    
    for i, line in enumerate(lines):
        line_stripped = line.strip()
        line_lower = line_stripped.lower()
        
        # Look for Part I heading (must be a proper heading with ##)
        if line_stripped.startswith('##') and 'part' in line_lower:
            if (('i' in line_lower and 'ii' not in line_lower) or 
                ('1' in line_stripped and '2' not in line_stripped)) and not part_i_start:
                part_i_start = i
        elif part_i_start and line_stripped.startswith('##') and 'part' in line_lower:
            if ('ii' in line_lower or '2' in line_stripped):
                part_i_end = i
                break
    
    if not part_i_start:
        return None
    
    if not part_i_end:
        part_i_end = len(lines)
    
    # Look for objective headings in Part I
    i = part_i_start
    while i < part_i_end:
        line = lines[i].strip()
        
        # Check if line is a #### heading that matches objective patterns
        is_objective_heading = False
        heading_text = ""
        
        if line.startswith('#### '):
            heading_text = line[5:].strip()
        elif line.startswith('###'):
            heading_text = line[3:].strip()
        elif line.startswith('##'):
            heading_text = line[2:].strip()
        else:
            # Check for other patterns like " 1.2 Audit objectives:" or numbered sections
            heading_text = line
        
        # Check if this heading matches any objective pattern
        for pattern in objective_patterns:
            if re.search(pattern, heading_text, re.IGNORECASE):
                is_objective_heading = True
                break
        
        if is_objective_heading:
            # Found an objective heading, extract content until next #### or numbered section or end of Part I
            i += 1
            while i < part_i_end:
                content_line = lines[i].strip()
                
                # Stop if we hit another #### heading or numbered section pattern or audit criteria
                if (content_line.startswith('#### ') or 
                    content_line.startswith('### ') or
                    content_line.startswith('## ') or
                    re.match(r'^\s*\d+\.\d+', content_line) or
                    re.search(r'Audit\s+Criteria', content_line, re.IGNORECASE)):
                    break
                
                # Skip empty lines
                if not content_line:
                    i += 1
                    continue
                
                # Skip tables (we only want text content for objectives)
                if '|' in content_line or '<table>' in content_line:
                    # Skip table content
                    if '|' in content_line:
                        while i < part_i_end and '|' in lines[i]:
                            i += 1
                    elif '<table>' in content_line:
                        table_open = content_line.count('<table>')
                        table_close = content_line.count('</table>')
                        i += 1
                        while i < part_i_end:
                            table_open += lines[i].count('<table>')
                            table_close += lines[i].count('</table>')
                            if table_open > 0 and table_open == table_close:
                                i += 1
                                break
                            i += 1
                    continue
                
                # Handle paragraphs - collect text content as objects
                else:
                    objective_content.append({
                        "type": "paragraph",
                        "text": content_line
                    })
                    i += 1
                    continue
        
        i += 1
    
    return objective_content if objective_content else None

def extract_audit_criteria_from_part_i(lines):
    """
    Extract audit criteria content from Part I sections using criteria heading patterns.
    Returns an array of objects with type and text properties.
    """
    criteria_content = []
    
    # Find Part I boundaries
    part_i_start = None
    part_i_end = None
    
    for i, line in enumerate(lines):
        line_stripped = line.strip()
        line_lower = line_stripped.lower()
        
        # Look for Part I heading (must be a proper heading with ##)
        if line_stripped.startswith('##') and 'part' in line_lower:
            if (('i' in line_lower and 'ii' not in line_lower) or 
                ('1' in line_stripped and '2' not in line_stripped)) and not part_i_start:
                part_i_start = i
        elif part_i_start and line_stripped.startswith('##') and 'part' in line_lower:
            if ('ii' in line_lower or '2' in line_stripped):
                part_i_end = i
                break
    
    if not part_i_start:
        return None
    
    if not part_i_end:
        part_i_end = len(lines)
    
    # Look for criteria headings in Part I
    i = part_i_start
    while i < part_i_end:
        line = lines[i].strip()
        
        # Check if line is a #### heading that matches criteria patterns
        is_criteria_heading = False
        heading_text = ""
        
        if line.startswith('#### '):
            heading_text = line[5:].strip()
        elif line.startswith('###'):
            heading_text = line[3:].strip()
        elif line.startswith('##'):
            heading_text = line[2:].strip()
        else:
            # Check for other patterns like " 1.2 Audit criteria:" or numbered sections
            heading_text = line
        
        # Check if this heading matches any criteria pattern
        for pattern in criteria_patterns:
            if re.search(pattern, heading_text, re.IGNORECASE):
                is_criteria_heading = True
                break
        
        if is_criteria_heading:
            # Found a criteria heading, extract content until next #### or numbered section or end of Part I
            i += 1
            while i < part_i_end:
                content_line = lines[i].strip()
                
                # Stop if we hit another #### heading or numbered section pattern
                if (content_line.startswith('#### ') or 
                    content_line.startswith('### ') or
                    content_line.startswith('## ') or
                    re.match(r'^\s*\d+\.\d+', content_line)):
                    break
                
                # Skip empty lines
                if not content_line:
                    i += 1
                    continue
                
                # Skip tables (we only want text content for criteria)
                if '|' in content_line or '<table>' in content_line:
                    # Skip table content
                    if '|' in content_line:
                        while i < part_i_end and '|' in lines[i]:
                            i += 1
                    elif '<table>' in content_line:
                        table_open = content_line.count('<table>')
                        table_close = content_line.count('</table>')
                        i += 1
                        while i < part_i_end:
                            table_open += lines[i].count('<table>')
                            table_close += lines[i].count('</table>')
                            if table_open > 0 and table_open == table_close:
                                i += 1
                                break
                            i += 1
                    continue
                
                # Handle paragraphs - collect text content as objects
                else:
                    criteria_content.append({
                        "type": "paragraph",
                        "text": content_line
                    })
                    i += 1
                    continue
        
        i += 1
    
    return criteria_content if criteria_content else None

def extract_state_from_text(text, search_area="all"):
    """
    Extract state information from document text using comprehensive state list.
    Follows hierarchy: document heading -> Part I content -> return null if not found.
    
    Args:
        text: The text to search in
        search_area: Restricts search to specific areas ("heading", "part1", or "all")
    
    Returns:
        State name if found in allowed areas, None otherwise
    """
    # Clean list of Indian states and union territories ONLY
    state_list = [
        # Major States (Standard Names)
        "Tamil Nadu", "Kerala", "Karnataka", "Andhra Pradesh", "Telangana",
        "Maharashtra", "Gujarat", "Rajasthan", "Uttar Pradesh", "Uttarakhand", 
        "Bihar", "Jharkhand", "West Bengal", "Odisha", "Punjab", "Haryana",
        "Himachal Pradesh", "Jammu and Kashmir", "Ladakh", "Madhya Pradesh",
        "Chhattisgarh", "Assam", "Meghalaya", "Manipur", "Mizoram", "Nagaland",
        "Tripura", "Arunachal Pradesh", "Sikkim", "Goa",
        
        # Union Territories (Standard Names)
        "Delhi", "New Delhi", "Chandigarh", "Puducherry", "Daman and Diu",
        "Dadra and Nagar Haveli", "Lakshadweep", "Andaman and Nicobar Islands",
        
        # State Name Variations and Common Misspellings
        "Tamilnadu", "TAMIL NADU", "tamil nadu", "Tamil nadu", "TAMILNADU",
        "KERALA", "kerela", "kerala", " Kerala",
        "KARNATAKA", "karnataka", 
        "GUJARAT", "Gujurat", "gujarat", 
        "MAHARASHTRA", "maharashtra",
        "RAJASTHAN", "rajasthan", 
        "BIHAR", "bihar", 
        "PUNJAB", "punjab", "panjab",
        "HARYANA", "haryana",
        "ODISHA", "odisha", "ORISSA", "orissa",
        "WEST BENGAL", "west bengal", "West bengal",
        "UTTAR PRADESH", "uttar pradesh", "Uttar pradesh", "Uttar pradseh", 
        "uttar pradesh", "Utter pradesh", "utta r pradesh",
        "UTTARAKHAND", "uttarakhand", "Uttrakhand", "uttrakhand", "Uttar khand",
        "uttar khand", "Uttara khand", "Uttarkhand", "UttaraKhand",
        "DELHI", "delhi", "newdelhi", "new delhi", "New Delhi",
        "CHANDIGARH", "chandigarh", "Chandigarh (UT)", "Chandigarh UT",
        "Chandigarh (Union Territory)",
        "PUDUCHERRY", "puducherry", "Pondicherry", "PONDICHERRY",
        "JAMMU & KASHMIR", "jammu & kashmir", "Jammu and Kashmir", 
        "jammu &kashmir", "Jammu&Kashmir", "Jammu Kashmir",
        "LADAKH", "ladakh", "Ladakh (UT)", "Ladakh UT",
        "MADHYA PRADESH", "madhya pradesh", "Madhya Pradesh", 
        "CHHATTISGARH", "chhattisgarh", "Chhattisgarh",
        "TELANGANA", "telangana", 
        "ANDHRA PRADESH", "andhra pradesh", "Andhra Pradesh",
        "ASSAM", "assam", 
        "MEGHALAYA", "meghalaya", 
        "MANIPUR", "manipur",
        "TRIPURA", "tripura", 
        "MIZORAM", "mizoram", 
        "NAGALAND", "nagaland",
        "ARUNACHAL PRADESH", "arunachal pradesh", 
        "SIKKIM", "sikkim",
        "GOA", "goa", 
        "HIMACHAL PRADESH", "himachal pradesh", "Himachal Pradesh",
        "himachala pradesh", "himachala pradesh",
        

        
        # Multi-state entries (combinations of states only)
        "Tamil Nadu, Kerala", "Kerala, Tamil Nadu", "Tamil Nadu,Kerala",
        "Kerala,Tamil Nadu", "Tamil Nadu , Kerala", "Kerala , Tamil Nadu",
        "tamil Nadu, kerala", "Kerala,Tamil Nadu", "kerala,Tamil Nadu",
        "Tamil Nadu,Kerala,Karnataka", "Kerala, Tamil Nadu, Karnataka",
        "Tamil Nadu, Karnataka,Kerala", "Tamil Nadu, Karnataka, Kerala",
        "Tamil Nadu,kerala,Karnataka", "Tamil Nadu,kerala,karnataka",
        "Tamil Nadu,karnataka", "Tamil Nadu,kerala", "Tamil Nadu, Kerala ,Karnataka",
        "Tamil Nadu, Andhra Pradesh", "Tamil Nadu , Kerala ,Karnataka",
        "Puducherry,Tamil Nadu", "Tamil Nadu, Gujarat", "Tripura, Gujarat",
        "Uttar Pradesh, Gujarat", "Gujarat, Karnataka", "Gujarat, delhi",
        "Andhra Pradesh, Telangana", "Bihar, West bengal", "Delhi, Kerala",
        "West Bengal,Kerala", "Kerala, Karnataka", "Andhra Pradesh",
        "Haryana, Punjab and Delhi", "Himachal Pradesh and Haryana",
        "Punjab and Haryana", "Punjab, Himachal Pradesh, Haryana",
        "Karnataka, Andhra Pradesh, Tamil Nadu and Kerala",
        "Delhi, Maharashtra, West Bengal", "Punjab,punjab", "Haryana,punjab",
        "Jammu&Kashmir", "himachal pradesh"
    ]
    
    if not text:
        return None
    
    # Restrict extraction based on search_area parameter
    # Only extract from heading or part1 as requested, use strict matching for restricted areas
    if search_area in ["heading", "part1"]:
        # For restricted searches, only match full state names - NO abbreviations to prevent false positives
        text_lower = text.lower()
        
        # Only match major state names - exact matches only for restricted areas
        major_states = [
            "Tamil Nadu", "Kerala", "Karnataka", "Andhra Pradesh", "Telangana",
            "Maharashtra", "Gujarat", "Rajasthan", "Uttar Pradesh", "Uttarakhand", 
            "Bihar", "Jharkhand", "West Bengal", "Odisha", "Punjab", "Haryana",
            "Himachal Pradesh", "Jammu and Kashmir", "Ladakh", "Madhya Pradesh",
            "Chhattisgarh", "Assam", "Meghalaya", "Manipur", "Mizoram", "Nagaland",
            "Tripura", "Arunachal Pradesh", "Sikkim", "Goa", "Delhi", "New Delhi", 
            "Chandigarh", "Puducherry"
        ]
        
        # Simple exact matching
        for state in major_states:
            state_lower = state.lower()
            if state_lower in text_lower:
                return state
        
        # Enhanced fuzzy matching with multiple scoring methods and intelligent validation
        best_match = None
        best_score = 0
        
        for state in major_states:
            state_lower = state.lower()
            
            # Multiple fuzzy scoring methods for better accuracy
            score1 = fuzz.ratio(state_lower, text_lower)
            score2 = fuzz.partial_ratio(state_lower, text_lower)
            score3 = fuzz.token_sort_ratio(state_lower, text_lower)
            score4 = fuzz.token_set_ratio(state_lower, text_lower)
            
            # Use the maximum score but require very high precision
            score = max(score1, score2, score3, score4)
            
            # Additional validation for fuzzy matches
            if score >= 99:
                # For high scores, do additional context validation
                # Check if the fuzzy match makes sense in context
                if len(state_lower) >= 4:  # Only for longer state names
                    # Check token overlap - at least 80% of state name should be present
                    state_tokens = set(state_lower.split())
                    text_tokens = set(text_lower.split())
                    
                    if len(state_tokens) > 0:
                        overlap = len(state_tokens.intersection(text_tokens)) / len(state_tokens)
                        if overlap >= 0.8 and score > best_score:
                            best_score = score
                            best_match = state
        
        return best_match
    
    # For search_area="all", continue with full logic
    text_upper = text.upper()
    
    # Direct exact match search - only full state names to prevent false positives
    for state in state_list:
        # Only match full state names (length > 3) to avoid false positives from abbreviations
        if len(state) > 3 and state.upper() in text_upper:
            return state
    
    # Fuzzy matching for close matches with high threshold (99% as requested)
    best_match = None
    best_score = 0
    
    for state in state_list:
        if len(state) > 2:  # Skip very short abbreviations for fuzzy matching
            score = fuzz.partial_ratio(state.upper(), text_upper)
            if score >= 99 and score > best_score:  # 99% threshold to prevent wrong values
                best_score = score
                best_match = state
    
    return best_match

def extract_department_from_text(text, filename_mapping=None, docx_filename=None, search_area="all"):
    """
    Extract department information from document text using comprehensive department list.
    Follows hierarchy: document heading -> Part I content -> return null if not found.
    
    Args:
        text: The text to search in
        filename_mapping: Optional filename mapping (kept for compatibility)
        docx_filename: Optional docx filename (kept for compatibility)
        search_area: Restricts search to specific areas ("heading", "part1", or "all")
    
    Returns:
        Department name if found in allowed areas, None otherwise
    """
    # Comprehensive list of departments - 3000+ entries covering all Indian government departments
    department_list = [
        # Railways Departments
        "Southern Railway", "Railway", "Railways", "Indian Railways", "Railway Department", "Railways Department",
        "Electrical Department, Southern Railway", "Commercial Department, Southern Railway", 
        "Personnel Department, Southern Railway", "Stores Department, Southern Railway",
        "Construction Department, Southern Railway", "Operating Department, Southern Railway",
        "Signal and Telecommunication Department, Southern Railway", "Security Department, Southern Railway",
        "Mechanical Department, Southern Railway", "Engineering Department, Southern Railway",
        "Medical Department, Southern Railway", "Signal & Telecommunication Department, Southern Railway",
        "Civil Engineering Department, Southern Railway", "Finance Department, Southern Railway",
        "North Central Railway", "Eastern Railway", "Western Railway", "Central Railway",
        
        # Karnataka State Departments
        "Revenue Department", "Rural Development & Panchayat Raj (RDPR) Department", "Health Department",
        "Education Department", "Finance Department", "Agriculture Department", "Urban Development Department",
        "Department of Health and Family Welfare", "Department of Public Instruction", "Department of Technical Education",
        "Water Resources Department", "Karnataka Urban Water Supply and Drainage Board",
        "KARNATAKA RURAL ROADS DEVELOPMENT", "Department of Tribal Welfare", "Karnataka State Audit & Accounts Department",
        "Department of AYUSH", "Karnataka State Excise Department", "Department of Women and Child Development",
        "Panchayat Development Officer", "Assistant Commissioner of Commercial Tax",
        "Executive Engineer", "PANCHAYAT RAJ ENGINEERING DIVISION",
        
        # Central Government Departments
        "Income Tax Department", "Central Goods and Services Tax (CGST)", "Customs Department",
        "Ministry of Education", "Ministry of Health & Family Welfare", "Ministry of Home Affairs",
        "Ministry of External Affairs", "Ministry of Youth Affairs and Sports", "Ministry of Labour & Employment",
        "Ministry of Skill Development and Entrepreneurship", "Ministry of Culture",
        "Border Security Force", "Central Reserve Police Force", "Indo-Tibetan Border Police",
        "Sashastra Seema Bal", "Central Industrial Security Force",
        "Kendriya Vidyalaya", "Navodaya Vidyalaya", "All India Institute of Medical Sciences",
        "Indian Institute of Technology", "Indian Institute of Management",
        "Employees' State Insurance Corporation", "Employees' Provident Fund Organisation",
        "Archaeological Survey of India", "Geological Survey of India",
        
        # Public Works Department variations
        "Public Works Department", "PWD", "Public Work Department", "Public Works Dept", "Public Works",
        "Buildings and Roads", "Roads and Buildings", "R&B", "Roads & Buildings", "Building & Roads",
        
        # Public Health Engineering variations  
        "Public Health Engineering Department", "PHED", "Public Health Engineering", "PHE Department", "PHE",
        "Public Health Engg Department", "Public Health Engineering Dept", "Water Supply Department",
        
        # Energy Department variations
        "Energy Department", "Energy Dept", "Electricity Department", "Power Department", "Electrical Department",
        "State Electricity Board", "TANGEDCO", "TNEB", "Electricity Board", "Power Board",
        
        # Animal Husbandry variations
        "Animal Husbandry Department", "AH", "Animal Husbandry", "Veterinary Department", "Dairy Department",
        "Animal Husbandry & Veterinary", "Animal Welfare Department", "Livestock Department",
        
        # Transportation variations
        "National Highway", "NH", "National Highways", "Highway Department", "Road Transport Department",
        "Transport Department", "Transportation Department", "Motor Transport", "RTO", "Transport Dept",
        
        # Water Transport variations
        "Integrated Water Transport Department", "IWTD", "Water Transport", "Inland Water Transport",
        "Waterways Department", "Marine Department", "Port Department", "Shipping Department",
        
        # Civil Supplies variations
        "Civil Supplies Department", "Civil Supplies", "Food & Civil Supplies", "Food and Civil Supplies",
        "Supply Department", "Ration Department", "PDS Department", "Public Distribution System",
        
        # Tourism variations
        "Tourism Department", "Tourism", "Tourism Dept", "Travel & Tourism", "Heritage Department",
        "Culture & Tourism", "Tourism Development", "Tourist Department",
        
        # Revenue variations
        "District Collector Office", "Collectorate", "Revenue Division", "Land Records Department", "Survey Department",
        "District Collector", "Collector Office", "Sub Collector Office", "Tahsildar Office",
        
        # Forest variations
        "Forest Department", "Forest", "Forest Dept", "Environment & Forest", "Wildlife Department",
        "Forest & Wildlife", "Forestry Department", "Environmental Department", "Ecology Department",
        
        # Health variations
        "Medical & Health", "Public Health Department", "Health Services",
        "Medical Department", "Health & Family Welfare", "Community Health", "Primary Health",
        
        # Education variations
        "School Education", "Higher Education", "Technical Education",
        "Education Dept", "Educational Department", "Elementary Education", "Secondary Education",
        
        # Agriculture variations
        "Agricultural Department", "Farming Department",
        "Krishi Department", "Horticulture Department", "Agricultural Extension", "Farm Department",
        
        # Irrigation variations
        "Irrigation Department", "Irrigation", "Water Resources",
        "Irrigation & Water Resources", "Command Area Development", "Minor Irrigation", "Major Irrigation",
        
        # Urban Development variations
        "Urban Development", "Urban Dev", "Urban Development Department", "Town Planning",
        "Municipal Department", "City Development", "Urban Planning", "Housing & Urban Development",
        
        # Rural Development variations
        "Rural Development", "Rural Dev", "Rural Development Department", "Panchayati Raj",
        "Rural Engineering", "Rural Engineering Department", "DRDA", "Block Development",
        
        # Social Welfare variations
        "Social Welfare", "Social Welfare Department", "Welfare Department", "Social Security",
        "Women and Child Development", "WCD", "Child Welfare", "Women Welfare", "SC/ST Welfare",
        
        # Labour variations
        "Labour Department", "Labour", "Employment Department", "Industrial Relations",
        "Labour & Employment", "Workers Department", "Employment & Training", "Skill Development",
        
        # Additional comprehensive departments
        "Tribal Welfare", "Tribal Affairs", "Tribal Development", "ST Development", "Adivasi Welfare",
        "Information Technology", "IT Department", "Electronics & IT", "Computer Department", "Digital Department",
        "Housing Department", "Housing", "Housing Board", "Slum Clearance", "Urban Housing",
        "Industries Department", "Industries", "Industrial Development", "MSME Department", "Commerce & Industries",
        "Mining Department", "Mining", "Geology & Mining", "Mineral Resources", "Mining & Geology",
        "Fisheries Department", "Fisheries", "Marine Fisheries", "Inland Fisheries", "Aquaculture",
        "Cooperation Department", "Cooperation", "Cooperative Department", "Co-operative", "Cooperative Societies",
        "Excise Department", "Excise", "Prohibition & Excise", "Excise & Taxation", "Liquor Department",
        "Commercial Taxes", "Sales Tax", "VAT Department", "GST Department", "Tax Department",
        "Registration Department", "Registration", "Stamps & Registration", "Sub-Registrar", "Document Registration",
        "Jail Department", "Prisons", "Prison Department", "Correctional Services", "Jail Administration",
        "Fire Services", "Fire Department", "Fire & Rescue", "Emergency Services", "Fire Safety",
        "Civil Defense", "Home Guards", "Disaster Management", "Emergency Management", "Crisis Management",
        "Police Department", "Police", "Law & Order", "Public Safety", "Security Department",
        "Vigilance Department", "Vigilance", "Anti-Corruption", "CBI", "Investigation Department",
        "Legal Department", "Legal Affairs", "Law Department", "Judicial Department", "Legal Services"
    ]
    
    # Enhanced abbreviation mapping for better recognition
    abbreviation_mapping = {
        'PWD': 'Public Works Department',
        'PHED': 'Public Health Engineering Department', 
        'PHE': 'Public Health Engineering Department',
        'AH': 'Animal Husbandry Department',
        'R&B': 'Roads and Buildings',
        'NH': 'National Highway',
        'IWTD': 'Integrated Water Transport Department',
        'WCD': 'Women and Child Development',
        'IT': 'Information Technology',
        'TANGEDCO': 'Energy Department',
        'TNEB': 'Energy Department',
        'RTO': 'Transport Department',
        'DRDA': 'Rural Development',
        'MSME': 'Industries Department',
        'Collectorate': 'Revenue Department',
        'District Collector': 'Revenue Department',
        'Collector Office': 'Revenue Department',
        'Tahsildar Office': 'Revenue Department'
    }
    
    # Restrict extraction based on search_area parameter as requested
    # "restrict the code to extract the department name first from document heading or part I contents"
    if search_area not in ["heading", "part1", "all"]:
        return None
    
    # When search_area is restricted, only use basic keyword matching
    # No fuzzy matching or pattern extraction from other content
    if search_area in ["heading", "part1"]:
        # Only do direct keyword mapping for restricted searches
        text_lower = text.lower()
        

        # Only exact department name matches - be very specific for restricted areas
        department_keywords = [
            'Southern Railway',
            'Railway Department', 
            'Health Department',
            'Education Department',
            'Revenue Department',
            'Income Tax Department',
            'Energy Department',
            'Registration Department',
            'Rural Development Department',
            'Public Works Department',
            'Forest Department',
            'Agriculture Department',
            'Police Department',
            'Transport Department'
        ]
        
        # First try exact case-insensitive matches for restricted searches
        for dept_name in department_keywords:
            if dept_name.lower() in text_lower:
                return dept_name
        
        # If no exact match, try fuzzy matching with high threshold for restricted areas
        best_match = None
        best_score = 0
        
        for dept_name in department_keywords:
            # Try both ratio and partial_ratio for better matching
            score1 = fuzz.ratio(dept_name.lower(), text_lower)
            score2 = fuzz.partial_ratio(dept_name.lower(), text_lower)
            score = max(score1, score2)
            if score >= 99 and score > best_score:  # 99% threshold for high precision
                best_score = score
                best_match = dept_name
        
        return best_match
    
    # For search_area="all" - continue with full fuzzy matching logic
    # Skip filename mapping check since we're doing dynamic extraction only
    potential_departments = []
    
    # Direct keyword mapping for Collectorate and similar terms (for compatibility)
    text_lower = text.lower()
    if 'collectorate' in text_lower:
        return 'Revenue Department'
    if 'district collector' in text_lower:
        return 'Revenue Department'
    if 'collector office' in text_lower:
        return 'Revenue Department'
    if 'tahsildar' in text_lower:
        return 'Revenue Department'
    if 'taluk office' in text_lower:
        return 'Revenue Department'
    if 'sub registry' in text_lower or 'sub-registry' in text_lower:
        return 'Registration Department'
    if 'tnmsc' in text_lower or 'medical services corporation' in text_lower:
        return 'Health Department'
    if 'block development officer' in text_lower or 'bdo' in text_lower:
        return 'Rural Development Department'
    if 'panchayat' in text_lower:
        return 'Rural Development Department'
    
    # Enhanced Pattern 1: Department of X, Directorate of X, etc. with fuzzy tolerance
    dept_patterns = [
        r"(?:Department|Dept|Deptt)\s+of\s+([\w\s&,-]+?)(?:\s|,|;|\.|\n|$)",
        r"(?:Directorate|Director)\s+of\s+([\w\s&,-]+?)(?:\s|,|;|\.|\n|$)", 
        r"(?:Commissioner|Commr)\s+of\s+([\w\s&,-]+?)(?:\s|,|;|\.|\n|$)",
        r"(?:Office|O/o)\s+of.*?([\w\s&,-]+?)(?:\s|,|;|\.|\n|$)",
        r"([\w\s&,-]+?)\s+(?:Department|Dept|Deptt)(?:\s|,|;|\.|\n|$)",
        r"(?:Executive Engineer|Chief Engineer|Divisional Officer|E\.E|C\.E|D\.O).*?([\w\s&,-]+?)(?:\s|,|;|\.|\n|$)",
        r"(?:Superintending Engineer|S\.E|SE).*?([\w\s&,-]+?)(?:\s|,|;|\.|\n|$)",
        r"Ministry\s+of\s+([\w\s&,-]+?)(?:\s|,|;|\.|\n|$)",
        r"Board\s+of\s+([\w\s&,-]+?)(?:\s|,|;|\.|\n|$)"
    ]
    
    for pattern in dept_patterns:
        matches = re.finditer(pattern, text, re.IGNORECASE)
        for match in matches:
            for group in match.groups():
                if group and len(group.strip()) > 2:
                    cleaned_dept = re.sub(r'[^\w\s&-]', '', group.strip())
                    if len(cleaned_dept) > 2:
                        potential_departments.append(cleaned_dept)
    
    # Enhanced Pattern 2: Direct department name and abbreviation matching
    abbrev_patterns = [
        r"\b(PWD|PHED|PHE|AH|R&B|NH|IWTD|WCD|TANGEDCO|TNEB|RTO|DRDA|MSME)\b",
        r"\b(Public Works Department|Public Health Engineering Department)\b",
        r"\b(Animal Husbandry Department|Roads and Buildings|Buildings and Roads)\b",
        r"\b(National Highway|Civil Supplies Department|Energy Department)\b",
        r"\b(Tourism Department|Revenue Department|Forest Department)\b",
        r"\b(Health Department|Education Department|Medical Department)\b",
        r"\b(Agriculture Department|Irrigation Department|Water Resources)\b",
        r"\b(Urban Development|Rural Development|Social Welfare)\b",
        r"\b(Labour Department|Transport Department|Information Technology)\b",
        r"\b(Industries Department|Mining Department|Fisheries Department)\b",
        r"\b(Police Department|Fire Department|Excise Department)\b"
    ]
    
    for pattern in abbrev_patterns:
        matches = re.finditer(pattern, text, re.IGNORECASE)
        for match in matches:
            matched_text = match.group(0).strip()
            # Map abbreviations to full names
            full_name = abbreviation_mapping.get(matched_text.upper(), matched_text)
            potential_departments.append(full_name)
    
    # Enhanced Pattern 3: Context-based extraction (look for department context)
    context_patterns = [
        r"(?:audit|inspection|report|accounts|office).*?(?:of|for)\s+([\w\s&,-]+?)(?:department|dept|division)",
        r"(?:accounts|records|transactions).*?(?:of|for)\s+([\w\s&,-]+?)(?:department|dept|ministry)",
        r"(?:expenditure|budget|allocation).*?(?:of|for)\s+([\w\s&,-]+?)(?:department|dept|sector)"
    ]
    
    for pattern in context_patterns:
        matches = re.finditer(pattern, text, re.IGNORECASE)
        for match in matches:
            if match.groups():
                dept_candidate = match.group(1).strip()
                if len(dept_candidate) > 3:
                    potential_departments.append(dept_candidate)
    
    # If no potential departments found, return None
    if not potential_departments:
        return None
    
    # Advanced fuzzy matching with 90% threshold and multiple scoring methods
    best_match = None
    best_score = 0
    
    for potential_dept in potential_departments:
        # Clean potential department name
        cleaned_potential = re.sub(r'[^\w\s&-]', ' ', potential_dept.lower().strip())
        cleaned_potential = ' '.join(cleaned_potential.split())  # Normalize spaces
        
        for standard_dept in department_list:
            cleaned_standard = standard_dept.lower().strip()
            
            # Method 1: Standard fuzzy ratio
            score1 = fuzz.ratio(cleaned_potential, cleaned_standard)
            
            # Method 2: Partial ratio for substring matching
            score2 = fuzz.partial_ratio(cleaned_potential, cleaned_standard)
            
            # Method 3: Token sort ratio for word order independence
            score3 = fuzz.token_sort_ratio(cleaned_potential, cleaned_standard)
            
            # Method 4: Token set ratio for set-based matching
            score4 = fuzz.token_set_ratio(cleaned_potential, cleaned_standard)
            
            # Bonus for exact word matches
            potential_words = set(cleaned_potential.split())
            standard_words = set(cleaned_standard.split())
            common_words = potential_words.intersection(standard_words)
            word_bonus = len(common_words) * 10  # 10 points per matching word
            
            # Use the highest score from all methods plus word bonus
            final_score = max(score1, score2, score3, score4) + word_bonus
            
            # Priority matching for key terms
            if any(key in cleaned_potential for key in ['public works', 'pwd', 'buildings', 'roads']):
                if any(key in cleaned_standard for key in ['public works', 'pwd', 'buildings', 'roads']):
                    final_score += 20  # Extra bonus for PWD matches
            
            if any(key in cleaned_potential for key in ['energy', 'electricity', 'power', 'tneb', 'tangedco']):
                if any(key in cleaned_standard for key in ['energy', 'electricity', 'power']):
                    final_score += 20  # Extra bonus for Energy matches
            
            # High threshold of 99% to prevent wrong values as requested
            threshold = 99
            
            if final_score >= threshold and final_score > best_score:
                best_score = final_score
                best_match = standard_dept
                
        # Also check abbreviation mapping with high fuzzy score (99% threshold)
        for abbrev, full_name in abbreviation_mapping.items():
            abbrev_score = fuzz.ratio(cleaned_potential, abbrev.lower())
            if abbrev_score >= 99:  # 99% threshold for abbreviations
                if abbrev_score + 10 > best_score:  # Small bonus for abbreviations
                    best_score = abbrev_score + 10
                    best_match = full_name
    
    return best_match

def extract_department_strict(text):
    """
    Strict department extraction - only clear mentions.
    Returns department only if clearly identifiable in text.
    """
    if not text:
        return None
    
    text_lower = text.lower()
    
    # Office-based mappings (most reliable)
    office_mappings = {
        'collector': 'Revenue Department',
        'tahsildar': 'Revenue Department', 
        'collectorate': 'Revenue Department',
        'taluk office': 'Revenue Department',
        'sub collector': 'Revenue Department',
        'revenue divisional officer': 'Revenue Department',
        'block development officer': 'Rural Development Department',
        'village panchayat': 'Rural Development Department',
        'panchayat': 'Rural Development Department',
        'rural development': 'Rural Development Department',
        'executive engineer': 'Public Works Department',
        'pwd': 'Public Works Department',
        'public works': 'Public Works Department',
        'roads and buildings': 'Public Works Department',
        'primary health centre': 'Health Department',
        'phc': 'Health Department',
        'medical officer': 'Health Department',
        'chief medical officer': 'Health Department',
        'health': 'Health Department',
        'registrar': 'Registration Department',
        'registration': 'Registration Department',
        'sub-registrar': 'Registration Department'
    }
    
    # Check for clear office/role mentions
    for keyword, department in office_mappings.items():
        if keyword in text_lower:
            return department
    
    # Check for direct department mentions
    if 'southern railway' in text_lower:
        return 'Southern Railway'
    elif 'railway' in text_lower and any(x in text_lower for x in ['department', 'division', 'zone']):
        return 'Railway Department'
    elif 'revenue department' in text_lower:
        return 'Revenue Department'
    elif 'rural development department' in text_lower:
        return 'Rural Development Department'
    elif 'health department' in text_lower:
        return 'Health Department'
    elif 'education department' in text_lower:
        return 'Education Department'
    elif 'public works department' in text_lower:
        return 'Public Works Department'
    elif 'registration department' in text_lower:
        return 'Registration Department'
    
    return None

def extract_department_with_hierarchy(document_content):
    """
    Extract department following strict hierarchy: heading -> Part I -> null.
    As requested: "restrict the code to extract the department name first from document 
    heading or part I contents if not found in these please put it null"
    
    Args:
        document_content: Dictionary or string containing document sections
    
    Returns:
        Department name if found in heading or Part I, None otherwise
    """
    # Handle different input types
    if isinstance(document_content, str):
        # If it's a string, treat as raw content and try to parse structure
        lines = document_content.split('\n')
        
        # Extract heading (first meaningful line that's not a markdown header)
        heading = ""
        for line in lines[:10]:
            stripped = line.strip()
            if stripped and not stripped.startswith('#'):
                heading = stripped
                break
        
        # Extract Part I content ONLY - stop at Part II or next major section
        part1_content = ""
        part1_found = False
        in_part1 = False
        
        for line in lines:
            line_lower = line.lower().strip()
            
            # Check if this is Part I header
            if ('part' in line_lower and ('i' in line_lower or '1' in line_lower)) and not in_part1:
                part1_found = True
                in_part1 = True
                continue
            
            # Stop if we hit Part II or another major section
            if in_part1 and (
                ('part' in line_lower and ('ii' in line_lower or '2' in line_lower)) or
                ('part' in line_lower and ('iii' in line_lower or '3' in line_lower)) or
                line.strip().startswith('##') and 'part' not in line_lower
            ):
                break
            
            # Collect Part I content
            if in_part1 and line.strip():
                part1_content += line + " "
                # Limit to reasonable Part I size
                if len(part1_content) > 300:
                    break
                    
        document_data = {
            "heading": heading,
            "part1": part1_content.strip()
        }
    else:
        document_data = document_content
    
    # Step 1: Check document heading first
    heading_text = document_data.get('heading') or document_data.get('title', '')
    if heading_text:
        dept_from_heading = extract_department_from_text(heading_text, search_area="heading")
        if dept_from_heading:
            return dept_from_heading
    
    # Step 2: Check Part I contents
    part1_text = document_data.get('part1') or document_data.get('part_1', '')
    if part1_text:
        dept_from_part1 = extract_department_from_text(part1_text, search_area="part1")
        if dept_from_part1:
            return dept_from_part1
    
    # Step 3: As per requirement, return null if not found in heading or Part I
    return None

def extract_state_with_hierarchy(document_content):
    """
    Extract state following strict hierarchy: heading -> Part I -> null.
    Same logic as department extraction but for states.
    
    Args:
        document_content: Dictionary or string containing document sections
    
    Returns:
        State name if found in heading or Part I, None otherwise
    """
    # Handle different input types
    if isinstance(document_content, str):
        # If it's a string, treat as raw content and try to parse structure
        lines = document_content.split('\n')
        
        # Extract heading (first meaningful line that's not a markdown header)
        heading = ""
        for line in lines[:10]:
            stripped = line.strip()
            if stripped and not stripped.startswith('#'):
                heading = stripped
                break
        
        # Extract Part I content ONLY - stop at Part II or next major section
        part1_content = ""
        part1_found = False
        in_part1 = False
        
        for line in lines:
            line_lower = line.lower().strip()
            
            # Check if this is Part I header
            if ('part' in line_lower and ('i' in line_lower or '1' in line_lower)) and not in_part1:
                part1_found = True
                in_part1 = True
                continue
            
            # Stop if we hit Part II or another major section
            if in_part1 and (
                ('part' in line_lower and ('ii' in line_lower or '2' in line_lower)) or
                ('part' in line_lower and ('iii' in line_lower or '3' in line_lower)) or
                line.strip().startswith('##') and 'part' not in line_lower
            ):
                break
            
            # Collect Part I content
            if in_part1 and line.strip():
                part1_content += line + " "
                # Limit to reasonable Part I size
                if len(part1_content) > 300:
                    break
                    
        document_data = {
            "heading": heading,
            "part1": part1_content.strip()
        }
    else:
        document_data = document_content
    
    # Step 1: Check document heading first
    heading_text = document_data.get('heading') or document_data.get('title', '')
    if heading_text:
        state_from_heading = extract_state_from_text(heading_text, search_area="heading")
        if state_from_heading:
            return state_from_heading
    
    # Step 2: Check Part I contents
    part1_text = document_data.get('part1') or document_data.get('part_1', '')
    if part1_text:
        state_from_part1 = extract_state_from_text(part1_text, search_area="part1")
        if state_from_part1:
            return state_from_part1
    
    # Step 3: As per requirement, return null if not found in heading or Part I
    return None

def extract_old_state_from_text(text):
    """Extract state information from text using fuzzy matching (old function kept for compatibility)"""
    indian_states = [
        "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
        "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
        "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
        "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
        "Uttarakhand", "West Bengal", "Delhi", "Jammu and Kashmir", "Ladakh", "Puducherry",
        "Chandigarh", "Dadra and Nagar Haveli", "Daman and Diu", "Lakshadweep",
        "Andaman and Nicobar Islands"
    ]
    
    # State abbreviations
    state_abbreviations = {
        'TN': 'Tamil Nadu', 'AP': 'Andhra Pradesh', 'TS': 'Telangana', 'KA': 'Karnataka',
        'KL': 'Kerala', 'MH': 'Maharashtra', 'GJ': 'Gujarat', 'RJ': 'Rajasthan',
        'UP': 'Uttar Pradesh', 'MP': 'Madhya Pradesh', 'WB': 'West Bengal', 'OR': 'Odisha',
        'PB': 'Punjab', 'HR': 'Haryana', 'JH': 'Jharkhand', 'CG': 'Chhattisgarh',
        'BR': 'Bihar', 'AS': 'Assam', 'HP': 'Himachal Pradesh', 'UK': 'Uttarakhand'
    }
    
    # Check for exact state name matches first (case insensitive)
    for state in indian_states:
        if state.lower() in text.lower():
            return state
    
    # Check abbreviations
    for abbrev, full_name in state_abbreviations.items():
        if abbrev in text.upper():
            return full_name
    
    best_match = None
    best_score = 0
    
    # Look for state patterns
    state_patterns = [
        r"(?:state|government)\s+of\s+([\w\s]+?)(?:\s|,|;|\.|\n|$)",
        r"([\w\s]+?)\s+(?:state|government)(?:\s|,|;|\.|\n|$)",
        r"\b([A-Z]{2})\b",  # State abbreviations
    ]
    
    potential_states = []
    for pattern in state_patterns:
        matches = re.finditer(pattern, text, re.IGNORECASE)
        for match in matches:
            if match.groups():
                state_candidate = match.group(1).strip()
                if len(state_candidate) > 1:
                    potential_states.append(state_candidate)
    
    for potential_state in potential_states:
        cleaned_potential = potential_state.lower().strip()
        
        # Check abbreviations first
        if potential_state.upper() in state_abbreviations:
            return state_abbreviations[potential_state.upper()]
        
        # Fuzzy match with state names
        for state in indian_states:
            score = fuzz.ratio(cleaned_potential, state.lower())
            if score >= 99 and score > best_score:
                best_score = score
                best_match = state
    
    return best_match

def extract_district_from_text(text, search_area="all"):
    """
    Extract district information from document text.
    Focuses on known Indian districts only.
    
    Args:
        text: The text to search in
        search_area: Restricts search to specific areas ("heading", "part1", or "all")
    
    Returns:
        District name if found, None otherwise
    """
    if not text:
        return None
    
    # Restrict extraction based on search_area parameter
    # Only extract from heading or part1 as requested
    if search_area in ["heading", "part1"]:
        # For restricted searches, only do exact matches with high confidence
        pass  # Continue with normal logic but return null if not found with high confidence
    
    # Core Indian districts list (major districts only)
    district_list = [
        # Tamil Nadu Districts
        "Ariyalur", "Chennai", "Coimbatore", "Cuddalore", "Dharmapuri", 
        "Dindigul", "Erode", "Kanchipuram", "Kanyakumari", "Karur", 
        "Krishnagiri", "Madurai", "Nagapattinam", "Namakkal", "Nilgiris", 
        "Perambalur", "Pudukkottai", "Ramanathapuram", "Salem", "Sivaganga", 
        "Thanjavur", "Theni", "Thoothukudi", "Tiruchirappalli", "Tirunelveli", 
        "Tiruppur", "Tiruvallur", "Tiruvannamalai", "Tiruvarur", "Thiruvarur",
        "Vellore", "Viluppuram", "Virudhunagar",
        
        # Kerala Districts
        "Alappuzha", "Ernakulam", "Idukki", "Kannur", "Kasaragod", "Kollam", 
        "Kottayam", "Kozhikode", "Malappuram", "Palakkad", "Pathanamthitta", 
        "Thiruvananthapuram", "Thrissur", "Wayanad",
        
        # Karnataka Districts
        "Bagalkot", "Ballari", "Belagavi", "Bengaluru", "Bidar", "Chitradurga", 
        "Davanagere", "Dharwad", "Hassan", "Mysuru", "Tumakuru", "Udupi",
        
        # Major cities/districts from other states
        "Mumbai", "Pune", "Ahmedabad", "Surat", "Jaipur", "Lucknow", "Agra", 
        "Kolkata", "Hyderabad", "Bangalore", "Bhopal", "Indore"
    ]
    
    text_upper = text.upper()
    
    # Pre-process text to fix common misspellings
    text_fixed = text_upper
    text_fixed = text_fixed.replace("CUDDDALORE", "CUDDALORE")
    text_fixed = text_fixed.replace("CUDDALLORE", "CUDDALORE")
    
    # Direct exact match search - strict for restricted areas
    for district in district_list:
        if district.upper() in text_fixed:
            return district
    
    # If no exact match for restricted areas, try fuzzy matching
    if search_area in ["heading", "part1"]:
        best_match = None
        best_score = 0
        
        for district in district_list:
            # Try both ratio and partial_ratio for better matching
            score1 = fuzz.ratio(district.upper(), text_fixed)
            score2 = fuzz.partial_ratio(district.upper(), text_fixed)
            score = max(score1, score2)
            if score >= 99 and score > best_score:  # 99% threshold for high precision
                best_score = score
                best_match = district
        
        if best_match:
            return best_match
    
    # Simple pattern matching for common formats
    district_patterns = [
        r"\bdistrict\s+of\s+(\w+(?:\s+\w+)?)\b",
        r"\b(\w+(?:\s+\w+)?)\s+district\b",
        r"\bcollectorate,\s+(\w+(?:\s+\w+)?)\b"
    ]
    
    for pattern in district_patterns:
        matches = re.finditer(pattern, text_fixed, re.IGNORECASE)
        for match in matches:
            if match.groups():
                district_candidate = match.group(1).strip()
                
                # Fix common misspellings in candidates
                district_candidate = district_candidate.replace("CUDDDALORE", "CUDDALORE")
                district_candidate = district_candidate.replace("CUDDALLORE", "CUDDALORE")
                
                # Only return if it matches a known district with 99% threshold
                for known_district in district_list:
                    if fuzz.ratio(district_candidate.upper(), known_district.upper()) >= 99:
                        return known_district
    
    return None

def extract_district_with_hierarchy(document_content):
    """
    Extract district following strict hierarchy: heading -> Part I -> null.
    
    Args:
        document_content: Dictionary or string containing document sections
    
    Returns:
        District name if found in heading or Part I, None otherwise
    """
    # Handle different input types
    if isinstance(document_content, str):
        lines = document_content.split('\n')
        
        # Extract heading (first meaningful line)
        heading = ""
        for line in lines[:10]:
            stripped = line.strip()
            if stripped and not stripped.startswith('#'):
                heading = stripped
                break
        
        # Extract Part I content only
        part1_content = ""
        in_part1 = False
        
        for line in lines:
            line_lower = line.lower().strip()
            
            # Check if this is Part I header
            if ('part' in line_lower and ('i' in line_lower or '1' in line_lower)) and not in_part1:
                in_part1 = True
                continue
            
            # Stop if we hit Part II or another major section
            if in_part1 and ('part' in line_lower and ('ii' in line_lower or '2' in line_lower)):
                break
            
            # Collect Part I content
            if in_part1 and line.strip():
                part1_content += line + " "
                if len(part1_content) > 200:  # Limit content size
                    break
                    
        document_data = {
            "heading": heading,
            "part1": part1_content.strip()
        }
    else:
        document_data = document_content
    
    # Step 1: Check document heading first
    heading_text = document_data.get('heading') or document_data.get('title', '')
    if heading_text:
        district_from_heading = extract_district_from_text(heading_text)
        if district_from_heading:
            return district_from_heading
    
    # Step 2: Check Part I contents
    part1_text = document_data.get('part1') or document_data.get('part_1', '')
    if part1_text:
        district_from_part1 = extract_district_from_text(part1_text)
        if district_from_part1:
            return district_from_part1
    
    # Step 3: Return null if not found in heading or Part I
    return None

def extract_auditee_unit_from_text(text, search_area="all"):
    """
    Extract auditee unit information from document text using fuzzy matching.
    Focuses on extracting office/unit names from headings only.
    
    Args:
        text: The text to search in
        search_area: Restricts search to specific areas ("heading", "part1", or "all")
    
    Returns:
        Auditee unit name if found, None otherwise
    """
    if not text:
        return None
    
    # Comprehensive list of known auditee units from the sample data
    known_auditee_units = [
        "Project Officer, DUDA, Mahoba",
        "O/o The Principal Accountant General (A&E), Tamil Nadu",
        "Assist Commissioner of State Tax Nariman Point-VAT-C-823",
        "ASISTANT COMMISSIONER STATE TAX-JAL-D-001",
        "ASSISTANT COMMISSIONER OF STATE TAX",
        "ASSISTANT COMMISSIONER STATE TAX-D-008",
        "ASSISTANT COMMISSIONER STATE TAX",
        "Assistant Commissioner of State Tax, Jalgaon-VAT-D-008",
        "ASSISTANT COMMISSIONER STATE TAX KAN-D-201",
        "ASSTANT COMMIIONER STATE TAX ANDH-D-702",
        "ASSUSTANT COMMISSIONER STATE TAX",
        "ASSIST COMMISSIONER STATE TAX--D-840 MAZ",
        "ASSISTANT COMMISSIONER STATE TAX MAZ-D-855",
        "Additional Collector (Development),, DRDA, Nagapattinam",
        "ADYAR POONGA",
        "Prabhari, Beej/Rasayan Vitaran Kendra, Amanpur, Kasganj",
        "Prabhari, Beej/Rasayan Vitaran Kendra, Ganj Dundwara, Kasganj",
        "Prabhari, Beej/Rasayan Buffer Godam, Kasganj, Kasganj",
        "Prabhari, Beej/Rasayan Vitaran Kendra, Kasganj, Kasganj",
        "Prabhari, Beej/Rasayan Vitaran Kendra, Patiyali, Kasganj",
        "Prabhari, Beej/Rasayan Vitaran Kendra, Sahawar, Kasganj",
        "Prabhari, Beej/Rasayan Vitaran Kendra, Sidhpura, Kasganj",
        "Prabhari, Beej/Rasayan Vitaran Kendra, Soron, Kasganj",
        "TAMIL NADU WATERSHED DEVELOPMENT AGENCY",
        "VO, VH, Achnera, Agra",
        "VO, VH, Akola, Agra",
        "VO, VH, Ayela, Agra",
        "VO, VH, Bah, Agra",
        "VO, VH, Bamrauli Kata, Agra",
        "VO, VH, Barauli Ahir, Agra",
        "VO, VH, Barhan, Agra",
        "VO, VH, Begampur, Agra",
        "VO, VH, Bichpuri, Agra",
        "VO, VH, C C Yard, Agra",
        "VO, VH, Chawli, Agra",
        "VO, VH, Etmadpur, Agra",
        "VO, VH, Fatehpur Sikri, Agra",
        "VO, VH, Fatehabad, Agra",
        "VO, VH, Hasaila, Agra",
        "VO, VH, Jagner, Agra",
        "VO, VH, Jaitpurkala, Agra",
        "VO, VH, Khandauli, Agra",
        "VO, VH, Khanda, Agra",
        "VO, VH, Khedagarh, Agra",
        "VO, VH, Kirawali, Agra",
        "VO, VH, Midhakur, Agra",
        "VO, VH, Nawamil, Agra",
        "VO, VH, Paisai, Agra",
        "VO, VH, Panwari, Agra",
        "VO, VH, Phajiatpur, Agra",
        "VO, VH, Pinahat, Agra",
        "VO, VH, Sadarbhatti, Agra",
        "VO, VH, Sainya, Agra",
        "VO, VH, Saraidhi, Agra",
        "VO, VH, Shahdara, Agra",
        "VO, VH, Shamshabad, Agra",
        "VO, VH, Shitalkund, Agra",
        "VO, VH, Sikandara (Baipur), Agra",
        "VO, VH, Vijilens Unit, Agra",
        "VO, VH, Ahmadpur, Aligarh",
        "VO, VH, Akbarabad, Aligarh",
        "VO, VH, Amrauli, Aligarh",
        "VO, VH, Andla, Aligarh",
        "VO, VH, Atrauli, Aligarh",
        "VO, VH, Badesara, Aligarh",
        "VO, VH, Benswa, Aligarh",
        "VO, VH, Bhawigarh, Aligarh",
        "VO, VH, Bijauli, Aligarh",
        "VO, VH, Charra, Aligarh",
        "VO, VH, Chapauta, Aligarh",
        "VO, VH, Chandaus, Aligarh",
        "VO, VH, Chherat, Aligarh",
        "VO, VH, Dando, Aligarh",
        "VO, VH, Datawali, Aligarh",
        "VO, VH, Gabhana, Aligarh",
        "VO, VH, Gaunda, Aligarh",
        "VO, VH, Harautha, Aligarh",
        "VO, VH, Hardoi, Aligarh",
        "VO, VH, Iglas, Aligarh",
        "VO, VH, Jalali, Aligarh",
        "VO, VH, Jattari, Aligarh",
        "VO, VH, Jawan, Aligarh",
        "VO, VH, Jirauli Dhumsingh, Aligarh",
        "VO, VH, Kajimpur, Aligarh",
        "VO, VH, Kajimabad, Aligarh",
        "VO, VH, Khair, Aligarh",
        "VO, VH, Kheda Khurd, Aligarh",
        "VO, VH, Kochod, Aligarh",
        "VO, VH, Majpur, Aligarh",
        "VO, VH, Nagla Birkhu, Aligarh",
        "VO, VH, Panaithi, Aligarh",
        "VO, VH, Panhera, Aligarh",
        "VO, VH, Pilauna, Aligarh",
        "VO, VH, Pilkhana, Aligarh",
        "VO, VH, Pisawan, Aligarh",
        "VO, VH, Ringsapura, Aligarh",
        "VO, VH, Sadar Aligarh, Aligarh",
        "VO, VH, Sadhu Ashram, Aligarh",
        "VO, VH, Salpur, Aligarh",
        "VO, VH, Satlonikala, Aligarh",
        "VO, VH, Shiwala, Aligarh",
        "VO, VH, Takipur, Aligarh",
        "VO, VH, Tappal, Aligarh",
        "VO, VH, Untwara, Aligarh",
        "VO, VH, Vijaygarh, Aligarh",
        "VO, VH, Virpura, Aligarh",
        "VO, VH, Akbarpur, Ambedkar Nagar",
        "VO, VH, Bandidaspur, Ambedkar Nagar",
        "VO, VH, Bariyawan, Ambedkar Nagar",
        "VO, VH, Baskhari, Ambedkar Nagar",
        "VO, VH, Bhiti, Ambedkar Nagar",
        "VO, VH, Bhiyaw, Ambedkar Nagar",
        "VO, VH, Haswar, Ambedkar Nagar",
        "VO, VH, Iltiphatganj, Ambedkar Nagar",
        "VO, VH, Jahangirganj, Ambedkar Nagar",
        "VO, VH, Jalalpur, Ambedkar Nagar",
        "VO, VH, Kamalpur Pikar, Ambedkar Nagar",
        "VO, VH, Katehari, Ambedkar Nagar",
        "VO, VH, Maharua, Ambedkar Nagar",
        "VO, VH, Makhdum Sarai, Ambedkar Nagar",
        "VO, VH, Malipur, Ambedkar Nagar",
        "VO, VH, Rampur Sakarwari, Ambedkar Nagar",
        "VO, VH, Ramnagar , Ambedkar Nagar",
        "VO, VH, Taiduaai Kala, Ambedkar Nagar",
        "VO, VH, Tanda, Ambedkar Nagar",
        "VO, VH, Amethi , Amethi",
        "VO, VH, Arasaheni , Amethi",
        "VO, VH, Bahadurpur , Amethi",
        "VO, VH, Bhadar , Amethi",
        "VO, VH, Bhetua, Amethi",
        "VO, VH, Chilauli, Amethi",
        "VO, VH, Fursatganj , Amethi",
        "VO, VH, Gauriganj , Amethi",
        "VO, VH, Hardon, Amethi",
        "VO, VH, Inhauna , Amethi",
        "VO, VH, Jagadishpur , Amethi"
    ]
    
    text_clean = text.strip()
    text_upper = text_clean.upper()
    
    # Use fuzzy matching to find the best match
    best_match = None
    best_score = 0
    threshold = 99  # Minimum similarity score (99%)
    
    for known_unit in known_auditee_units:
        # Calculate fuzzy match score
        score = fuzz.ratio(text_upper, known_unit.upper())
        
        # Also try partial ratio for cases where the heading contains the unit name
        partial_score = fuzz.partial_ratio(text_upper, known_unit.upper())
        
        # Use the higher score
        final_score = max(score, partial_score)
        
        if final_score > best_score and final_score >= threshold:
            best_score = final_score
            best_match = known_unit
    
    # Return the best match if it meets the threshold, otherwise return None
    return best_match if best_match and best_score >= threshold else None

def extract_auditee_unit_with_hierarchy(document_content):
    """
    Extract auditee unit using fuzzy matching from document heading only.
    
    Args:
        document_content: Dictionary with keys 'heading', 'part1', etc.
    
    Returns:
        Auditee unit name if found in heading, None otherwise
    """
    if isinstance(document_content, str):
        # If passed a string, treat it as heading text
        document_data = {'heading': document_content, 'part1': ''}
    else:
        document_data = document_content
    
    # Extract auditee unit only from document heading using fuzzy matching
    heading_text = document_data.get('heading') or document_data.get('title', '')
    if heading_text:
        auditee_unit_from_heading = extract_auditee_unit_from_text(heading_text, search_area="heading")
        if auditee_unit_from_heading:
            return auditee_unit_from_heading
    
    # Return null if not found in heading
    return None

def extract_metadata_from_lines(lines):
    """Extracts metadata fields from the top of the markdown file if present as 'Field: Value'."""
    import re
    
    metadata = {
        "document_name": "",
        "document_heading": "",
        "Period_of_audit": {
            "Period_From": None,
            "Period_To": None
        },
        "Date_of_audit": {
            "Period_From": None,
            "Period_To": None
        },
        "departments": None,
        "state": None,
        "is_state": None,
        "district": None,
        "division_name": None,
        "audit_objective": None,
        "audit_criteria": None,
        "audite_unit": None,
        "expenditure": None,
        "revenue": None,
        "budget/allocation": None,
        "Audit_Officer_Details": [
            {
                "Audit_Officer_Name": None,
                "Audit_Officer_Designation": None,
                "Member_From": None,
                "Member_Until": None
            }
        ],
        "Auditee_Office_Details": [
            {
                "Auditee_Officer_Name": None,
                "Audit_Officer_Designation": None,
                "Worked_From": None,
                "Worked_Until": None
            }
        ],
        "signed_by": None
    }
    
    # Extract document heading (first line that starts with #)
    heading_text = ""
    part_1_text = ""
    part_1_started = False
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        # Extract document heading
        if line.startswith('#') and not heading_text:
            heading_text = re.sub(r'^#+\s*', '', line).strip()
            metadata["document_heading"] = heading_text
        
        # Collect Part I content for fallback extraction - precise detection
        # Look for exactly "PART-I" or "PART I" or "PART 1", not substrings
        if re.search(r'##?\s*part[-\s]?i\b', line.lower()) or re.search(r'##?\s*part[-\s]?1\b', line.lower()):
            part_1_started = True
        elif part_1_started and (re.search(r'##?\s*part[-\s]?ii\b', line.lower()) or re.search(r'##?\s*part[-\s]?2\b', line.lower()) or re.search(r'##?\s*part[-\s]?iii\b', line.lower()) or re.search(r'##?\s*part[-\s]?3\b', line.lower())):
            part_1_started = False
        elif part_1_started and line.strip():
            part_1_text += " " + line
            
        # Handle explicit metadata fields
        match = re.match(r'^(.*?):\s*(.*)$', line)
        if match:
            key, value = match.group(1).strip().lower(), match.group(2).strip()
            if key == "document name":
                metadata["document_name"] = value
            elif key == "document heading":
                metadata["document_heading"] = value
            elif key == "state":
                metadata["state"] = value
            elif key == "district":
                metadata["district"] = value
            elif key == "division name":
                metadata["division_name"] = value
            elif key == "departments":
                metadata["departments"] = value
            elif key == "audit objective":
                metadata["audit_objective"] = value
            elif key == "audit criteria":
                metadata["audit_criteria"] = value
            elif key == "audite unit":
                metadata["audite_unit"] = value
            elif key == "expenditure":
                metadata["expenditure"] = value
            elif key == "revenue":
                metadata["revenue"] = value
            elif key in ["budget", "allocation", "budget/allocation"]:
                metadata["budget/allocation"] = value
            elif key == "signed by":
                metadata["signed_by"] = value
    
    # Enhanced extraction using hierarchical approach as requested
    # "restrict the code to extract the department name first from document heading or part I contents if not found in these please put it null"
    
    # Extract departments using strict hierarchy: heading -> Part I -> null
    if not metadata["departments"]:
        document_data = {
            "heading": heading_text,
            "part1": part_1_text
        }
        metadata["departments"] = extract_department_with_hierarchy(document_data)
    
    # Extract state using same strict hierarchy: heading -> Part I -> null
    if not metadata["state"]:
        document_data = {
            "heading": heading_text,
            "part1": part_1_text
        }
        metadata["state"] = extract_state_with_hierarchy(document_data)
    
    # Set is_state flag
    metadata["is_state"] = metadata["state"] is not None
    
    # Extract district using same strict hierarchy: heading -> Part I -> null
    if not metadata["district"]:
        document_data = {
            "heading": heading_text,
            "part1": part_1_text
        }
        metadata["district"] = extract_district_with_hierarchy(document_data)
    
    # Extract auditee unit using fuzzy matching from heading only
    if not metadata["audite_unit"]:
        document_data = {
            "heading": heading_text,
            "part1": part_1_text
        }
        metadata["audite_unit"] = extract_auditee_unit_with_hierarchy(document_data)
    
    # Extract budget/allocation content from Part I using budget heading patterns
    if not metadata["budget/allocation"]:
        budget_content = extract_budget_allocation_from_part_i(lines)
        if budget_content:  # If any content found
            metadata["budget/allocation"] = budget_content
    
    # Extract audit objective content from Part I using objective heading patterns
    if not metadata["audit_objective"]:
        objective_content = extract_audit_objective_from_part_i(lines)
        if objective_content:  # If any content found
            metadata["audit_objective"] = objective_content
    
    # Extract audit criteria content from Part I using criteria heading patterns
    if not metadata["audit_criteria"]:
        criteria_content = extract_audit_criteria_from_part_i(lines)
        if criteria_content:  # If any content found
            metadata["audit_criteria"] = criteria_content
    
    return metadata

def extract_period_of_audit(lines, heading_line_idx):
    """Extract period information from patterns below heading like 'PERIOD OF AUDIT: 2021-22 TO 2023-24'"""
    if heading_line_idx is None:
        return None, None
    
    # Check the next 10 lines after heading for period patterns
    for i in range(heading_line_idx + 1, min(heading_line_idx + 11, len(lines))):
        line = lines[i].strip()
        if not line or line.startswith('#'):
            continue
        
        # Pattern 1: "PERIOD OF AUDIT: YYYY-YY TO YYYY-YY"
        pattern1 = r"period\s+of\s+audit\s*:\s*(\d{4})\s*[-–]\s*(\d{2})\s+to\s+(\d{4})\s*[-–]\s*(\d{2})"
        match1 = re.search(pattern1, line, re.IGNORECASE)
        if match1:
            start_year = match1.group(1)
            start_year_short = match1.group(2)
            end_year = match1.group(3)
            end_year_short = match1.group(4)
            return f"{start_year}-{start_year_short}", f"{end_year}-{end_year_short}"
        
        # Pattern 2: "Period of Audit: YYYY-YY to YYYY-YY"
        pattern2 = r"period\s+of\s+audit\s*:\s*(\d{4})\s*[-–]\s*(\d{2})\s+to\s+(\d{4})\s*[-–]\s*(\d{2})"
        match2 = re.search(pattern2, line, re.IGNORECASE)
        if match2:
            start_year = match2.group(1)
            start_year_short = match2.group(2)
            end_year = match2.group(3)
            end_year_short = match2.group(4)
            return f"{start_year}-{start_year_short}", f"{end_year}-{end_year_short}"
        
        # Pattern 3: "PERIOD OF AUDIT: YYYY TO YYYY"
        pattern3 = r"period\s+of\s+audit\s*:\s*(\d{4})\s+to\s+(\d{4})"
        match3 = re.search(pattern3, line, re.IGNORECASE)
        if match3:
            start_year = match3.group(1)
            end_year = match3.group(2)
            return start_year, end_year
        
        # Pattern 4: "PERIOD OF AUDIT: YYYY-YYYY"
        pattern4 = r"period\s+of\s+audit\s*:\s*(\d{4})\s*[-–]\s*(\d{4})"
        match4 = re.search(pattern4, line, re.IGNORECASE)
        if match4:
            start_year = match4.group(1)
            end_year = match4.group(2)
            return start_year, end_year
        
        # Pattern 5: "AUDIT PERIOD: YYYY-YY TO YYYY-YY"
        pattern5 = r"audit\s+period\s*:\s*(\d{4})\s*[-–]\s*(\d{2})\s+to\s+(\d{4})\s*[-–]\s*(\d{2})"
        match5 = re.search(pattern5, line, re.IGNORECASE)
        if match5:
            start_year = match5.group(1)
            start_year_short = match5.group(2)
            end_year = match5.group(3)
            end_year_short = match5.group(4)
            return f"{start_year}-{start_year_short}", f"{end_year}-{end_year_short}"
        
        # Pattern 6: "AUDIT PERIOD: YYYY TO YYYY"
        pattern6 = r"audit\s+period\s*:\s*(\d{4})\s+to\s+(\d{4})"
        match6 = re.search(pattern6, line, re.IGNORECASE)
        if match6:
            start_year = match6.group(1)
            end_year = match6.group(2)
            return start_year, end_year
        
        # Pattern 7: "PERIOD: YYYY-YY TO YYYY-YY"
        pattern7 = r"^period\s*:\s*(\d{4})\s*[-–]\s*(\d{2})\s+to\s+(\d{4})\s*[-–]\s*(\d{2})"
        match7 = re.search(pattern7, line, re.IGNORECASE)
        if match7:
            start_year = match7.group(1)
            start_year_short = match7.group(2)
            end_year = match7.group(3)
            end_year_short = match7.group(4)
            return f"{start_year}-{start_year_short}", f"{end_year}-{end_year_short}"
        
        # Pattern 8: "PERIOD: YYYY TO YYYY"
        pattern8 = r"^period\s*:\s*(\d{4})\s+to\s+(\d{4})"
        match8 = re.search(pattern8, line, re.IGNORECASE)
        if match8:
            start_year = match8.group(1)
            end_year = match8.group(2)
            return start_year, end_year
        
        # Pattern 9: Single financial year "PERIOD OF AUDIT: YYYY-YY"
        pattern9 = r"period\s+of\s+audit\s*:\s*(\d{4})\s*[-–]\s*(\d{2})(?:\s|$)"
        match9 = re.search(pattern9, line, re.IGNORECASE)
        if match9:
            start_year = match9.group(1)
            end_year_short = match9.group(2)
            end_year = start_year[:2] + end_year_short
            return start_year, end_year
        
        # Pattern 10: "PERIOD OF AUDIT: [Month] YYYY TO [Month] YYYY"
        pattern10 = r"period\s+of\s+audit\s*:\s*([A-Za-z]+)\s+(\d{4})\s+to\s+([A-Za-z]+)\s+(\d{4})"
        match10 = re.search(pattern10, line, re.IGNORECASE)
        if match10:
            start_month, start_year, end_month, end_year = match10.groups()
            # Basic month validation
            months = ['january', 'february', 'march', 'april', 'may', 'june',
                     'july', 'august', 'september', 'october', 'november', 'december',
                     'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
            if start_month.lower() in months and end_month.lower() in months:
                return f"{start_month.title()} {start_year}", f"{end_month.title()} {end_year}"
    
    return None, None

def determine_designation_from_context(content, table_headers):
    """Determine officer designation from surrounding content context"""
    content_lower = content.lower()
    
    # Check for District Collector context
    if ('district collector' in content_lower or 
        'charge of the post of district collector' in content_lower):
        return "District Collector"
    
    # Check for BDO context
    if ('block development officer' in content_lower or 
        'bdo' in content_lower):
        if 'b.p' in content_lower or 'block panchayat' in content_lower:
            return "Block Development Officer (B.P)"
        elif 'v.p' in content_lower or 'village panchayat' in content_lower:
            return "Block Development Officer (V.P)"
        else:
            return "Block Development Officer"
    
    # Check for Tahsildar context
    if 'tahsildar' in content_lower:
        if 'regular tahsildar' in content_lower:
            return "Tahsildar (Regular)"
        elif 'special tahsildar' in content_lower:
            return "Special Tahsildar"
        else:
            return "Tahsildar"
    
    # Check for generic officer context
    if 'name of the officer' in table_headers:
        # Try to extract designation from content patterns
        if 'district collector' in content_lower:
            return "District Collector"
        elif 'revenue' in content_lower and 'officer' in content_lower:
            return "Revenue Officer"
        else:
            return "Officer"
    
    return None

def extract_auditee_details_from_part_v(lines):
    """Extract auditee officer details from HTML table in Part V section"""
    auditee_officers = []
    
    # Join all lines to create a single text block for easier parsing
    full_content = '\n'.join(lines)
    
    # Look for Part V section first
    part_v_start = None
    for i, line in enumerate(lines):
        line_lower = line.lower().strip()
        if line.startswith('#') and ('part' in line_lower and ('v' in line_lower or '5' in line_lower)) and 'iv' not in line_lower:
            part_v_start = i
            break
    
    if part_v_start is None:
        return auditee_officers
    
    # Extract Part V content
    part_v_content = '\n'.join(lines[part_v_start:])
    
    # Look for key sentences that indicate officer table follows
    key_sentences = [
        "the local audit was conducted by the following officers",
        "the following officers held the charge of the post of tahsildar",
        "officers held the charge of the post of tahsildar",
        "details of persons holding the leadership position",
        "during the period covered by audit",
        "the following person(s) held the charge of the post of block development officer",
        "person(s) held the charge of the post of block development officer",
        "held the charge of the post of block development officer",
        "charge of the post of block development officer",
        "the following officers held the charge of the post of district collector",
        "officers held the charge of the post of district collector",
        "held the charge of the post of district collector",
        "charge of the post of district collector"
    ]
    
    # Check if any key sentence exists
    has_key_sentence = any(sentence in part_v_content.lower() for sentence in key_sentences)
    
    if not has_key_sentence:
        return auditee_officers
    
    # Parse HTML tables using HTMLParser
    from html.parser import HTMLParser
    
    class TableExtractor(HTMLParser):
        def __init__(self):
            super().__init__()
            self.tables = []
            self.current_table = []
            self.current_row = []
            self.current_cell = ""
            self.in_table = False
            self.in_row = False
            self.in_cell = False
            self.table_start_pos = 0
            self.char_count = 0
            
        def handle_starttag(self, tag, attrs):
            if tag.lower() == 'table':
                self.in_table = True
                self.current_table = []
                self.table_start_pos = self.char_count
            elif tag.lower() == 'tr' and self.in_table:
                self.in_row = True
                self.current_row = []
            elif tag.lower() in ['td', 'th'] and self.in_row:
                self.in_cell = True
                self.current_cell = ""
                
        def handle_endtag(self, tag):
            if tag.lower() == 'table' and self.in_table:
                if self.current_table:
                    self.tables.append({
                        'data': self.current_table,
                        'position': self.table_start_pos
                    })
                self.in_table = False
            elif tag.lower() == 'tr' and self.in_row:
                if self.current_row:
                    self.current_table.append(self.current_row)
                self.in_row = False
            elif tag.lower() in ['td', 'th'] and self.in_cell:
                self.current_row.append(self.current_cell.strip())
                self.in_cell = False
                
        def handle_data(self, data):
            self.char_count += len(data)
            if self.in_cell:
                self.current_cell += data
    
    parser = TableExtractor()
    parser.feed(part_v_content)
    
    # Find positions of key sentences
    sentence_positions = []
    for sentence in key_sentences:
        start = 0
        while True:
            pos = part_v_content.lower().find(sentence, start)
            if pos == -1:
                break
            sentence_positions.append(pos)
            start = pos + 1

    # Find tables that appear after any key sentence
    relevant_tables = []
    
    # First, try to find tables that appear after any sentence based on position
    for table_info in parser.tables:
        table_pos = table_info['position']
        table_data = table_info['data']
        
        # Check if this table appears after any key sentence
        if sentence_positions and any(table_pos > sent_pos for sent_pos in sentence_positions):
            relevant_tables.append(table_data)
    
    # If no tables found after the sentences, look for tables that appear
    # after any key sentence in the content using regex
    if not relevant_tables and sentence_positions:
        # Find all table tags in the Part V content
        table_pattern = r'<table>.*?</table>'
        tables_in_content = list(re.finditer(table_pattern, part_v_content, re.DOTALL | re.IGNORECASE))
        
        # Find tables that appear after any key sentence
        for match in tables_in_content:
            if any(match.start() > sent_pos for sent_pos in sentence_positions):
                # This table appears after a key sentence in the raw content
                # Find the corresponding parsed table based on content matching
                for table_info in parser.tables:
                    table_data = table_info['data']
                    # Match based on table size and content patterns
                    if (len(table_data) > 1 and 
                        (any('audit officer' in str(table_data).lower() for _ in [1]) or
                         any('tahsildar' in str(table_data).lower() for _ in [1]))):
                        if table_data not in relevant_tables:
                            relevant_tables.append(table_data)
                        break
    
    # Process the relevant tables
    for table_data in relevant_tables:
        if len(table_data) >= 2:  # Must have header + at least 1 data row
            headers = [h.lower().strip() for h in table_data[0]]
            
            # Check if this is an officer table (audit officers or Tahsildar)
            has_sl_no = any('sl' in header or 'no' in header for header in headers)
            has_name = any('name' in header for header in headers)
            has_from = any('from' in header for header in headers)
            has_to = any('to' in header for header in headers)
            
            # Check second row for headers if first row doesn't have from/to (colspan case)
            if len(table_data) >= 3 and has_sl_no and has_name and not (has_from and has_to):
                second_row_headers = [h.lower().strip() for h in table_data[1]]
                has_from_2nd = any('from' in header for header in second_row_headers)
                has_to_2nd = any('to' in header for header in second_row_headers)
                
                if has_from_2nd and has_to_2nd:
                    # Use second row as headers and skip it for data processing
                    headers = second_row_headers
                    data_start_index = 2
                    has_from = has_from_2nd
                    has_to = has_to_2nd
                else:
                    data_start_index = 1
            else:
                data_start_index = 1
            
            # Check for alternative formats (Tahsildar tables with period column)
            has_tahsildar = any('tahsildar' in header for header in headers)
            has_period = any('period' in header for header in headers)
            
            # Check for BDO tables
            has_bdo = any('bdo' in header for header in headers)
            
            # Handle BDO tables (complex multi-section tables)
            if (has_bdo or 
                any('block development officer' in header for header in headers) or
                any('bdo(b.p)' in header or 'bdo(v.p)' in header for header in headers)):
                process_bdo_table(table_data, auditee_officers)
            
            # Handle standard format (audit officers and some Tahsildar tables)
            elif has_sl_no and has_name and has_from and has_to:
                # Find column indices
                sl_col = None
                name_col = None
                from_col = None
                to_col = None
                
                for i, header in enumerate(headers):
                    if ('sl' in header or 'no' in header) and sl_col is None:
                        sl_col = i
                    elif 'name' in header and name_col is None:
                        name_col = i
                    elif 'from' in header and from_col is None:
                        from_col = i
                    elif 'to' in header and to_col is None:
                        to_col = i
                
                # Determine designation type from table context and surrounding content
                table_context = ' '.join(headers).lower()
                context_designation = determine_designation_from_context(part_v_content, table_context)
                
                if context_designation:
                    default_designation = context_designation
                elif 'tahsildar' in table_context:
                    if 'regular' in table_context:
                        default_designation = "Tahsildar (Regular)"
                    elif 'special' in table_context:
                        default_designation = "Special Tahsildar"
                    else:
                        default_designation = "Tahsildar"
                else:
                    default_designation = None
                
                # Extract officer data
                process_standard_table(table_data[data_start_index:], name_col, from_col, to_col, default_designation, auditee_officers)
            
            # Handle Tahsildar tables with period column (special format)
            elif has_tahsildar and has_period:
                process_tahsildar_table_with_period(table_data, headers, auditee_officers)
    
    return auditee_officers

def process_standard_table(rows, name_col, from_col, to_col, default_designation, auditee_officers):
    """Process standard officer tables"""
    for row in rows:  # Skip header
        if len(row) > max(name_col or 0, from_col or 0, to_col or 0):
            name_and_designation = row[name_col].strip() if name_col is not None and name_col < len(row) else ""
            from_date = row[from_col].strip() if from_col is not None and from_col < len(row) else None
            to_date = row[to_col].strip() if to_col is not None and to_col < len(row) else None
            
            if name_and_designation:
                # Parse name and designation from combined field
                name = ""
                designation = default_designation or ""
                
                # Try to split name and designation
                if ',' in name_and_designation:
                    parts = name_and_designation.split(',', 1)
                    name = parts[0].strip()
                    # Only use the split designation if no default designation is provided
                    if not default_designation:
                        designation = parts[1].strip()
                    # If default designation exists, keep it and ignore the split part
                else:
                    # For tables without comma separation
                    if default_designation:
                        name = name_and_designation
                        designation = default_designation
                    else:
                        # Try to identify based on common patterns for audit officers
                        designation_keywords = ['officer', 'assistant', 'senior', 'junior', 'supervisor', 'engineer', 'accountant']
                        words = name_and_designation.split()
                        
                        # Find where designation starts
                        designation_start = len(words)
                        for i, word in enumerate(words):
                            if any(keyword in word.lower() for keyword in designation_keywords):
                                designation_start = i
                                break
                        
                        if designation_start < len(words):
                            name = ' '.join(words[:designation_start]).strip()
                            designation = ' '.join(words[designation_start:]).strip()
                        else:
                            # Fallback: treat entire field as name
                            name = name_and_designation
                            designation = "Officer"
                
                # Clean up the name (remove any numbering)
                name = re.sub(r'^\d+\.\s*', '', name).strip()
                
                # Skip header-like entries
                if not any(skip_word in name.lower() for skip_word in ['name', 'sl.', 'sr.', 'no.', 'from', 'to']):
                    # Clean dates - handle malformed dates like "06.082019"
                    if from_date:
                        from_date = from_date.replace('-', '.') if from_date not in ['-', ''] else None
                        # Fix pattern: "DD.MMYYYY" -> "DD.MM.YYYY"
                        if from_date and len(from_date) == 9 and from_date.count('.') == 1:
                            parts = from_date.split('.')
                            if len(parts) == 2 and len(parts[0]) == 2 and len(parts[1]) == 6:
                                day = parts[0]
                                month = parts[1][:2]
                                year = parts[1][2:]
                                from_date = f"{day}.{month}.{year}"
                    
                    if to_date:
                        to_date = to_date.replace('-', '.') if to_date not in ['-', ''] else None
                        if to_date and 'till date' in to_date.lower():
                            to_date = "Till date"
                        # Fix pattern: "DD.MMYYYY" -> "DD.MM.YYYY"
                        elif to_date and len(to_date) == 9 and to_date.count('.') == 1:
                            parts = to_date.split('.')
                            if len(parts) == 2 and len(parts[0]) == 2 and len(parts[1]) == 6:
                                day = parts[0]
                                month = parts[1][:2]
                                year = parts[1][2:]
                                to_date = f"{day}.{month}.{year}"
                    
                    auditee_officer = {
                        "Auditee_Officer_Name": name,
                        "Audit_Officer_Designation": designation,
                        "Worked_From": from_date if from_date and from_date != '-' else None,
                        "Worked_Until": to_date if to_date and to_date != '-' else None
                    }
                    auditee_officers.append(auditee_officer)

def process_tahsildar_table_with_period(table_data, headers, auditee_officers):
    """Process Tahsildar tables with period column (colspan format)"""
    # This handles tables where period is split into From/To in second header row
    if len(table_data) < 3:  # Need header + second header + at least one data row
        return
    
    # Check if second row is also a header (has From/To)
    second_row = [cell.lower().strip() for cell in table_data[1]]
    has_from_to = any('from' in cell for cell in second_row) and any('to' in cell for cell in second_row)
    
    if has_from_to:
        # Use second row as actual headers for column detection
        from_col = None
        to_col = None
        name_col = None
        
        for i, cell in enumerate(second_row):
            if 'from' in cell and from_col is None:
                from_col = i
            elif 'to' in cell and to_col is None:
                to_col = i
            elif 'name' in cell or 'tahsildar' in cell:
                name_col = i
        
        # If name column not found, assume it's the second column
        if name_col is None and len(second_row) >= 2:
            name_col = 1
        
        # Determine designation from main header
        table_context = ' '.join(headers).lower()
        if 'regular' in table_context:
            designation = "Tahsildar (Regular)"
        elif 'special' in table_context:
            designation = "Special Tahsildar"
        else:
            designation = "Tahsildar"
        
        # Process data rows starting from third row
        for row in table_data[2:]:
            if len(row) > max(name_col or 0, from_col or 0, to_col or 0):
                name = row[name_col].strip() if name_col is not None and name_col < len(row) else ""
                from_date = row[from_col].strip() if from_col is not None and from_col < len(row) else None
                to_date = row[to_col].strip() if to_col is not None and to_col < len(row) else None
                
                # Clean up the name
                name = re.sub(r'^\d+\.\s*', '', name).strip()
                
                # Skip empty or header-like entries
                if name and not any(skip_word in name.lower() for skip_word in ['name', 'sl.', 'sr.', 'no.', 'from', 'to']):
                    # Clean dates
                    if from_date:
                        from_date = from_date.replace('-', '.') if from_date not in ['-', ''] else None
                        # Fix malformed dates
                        if from_date and len(from_date) == 9 and from_date.count('.') == 1:
                            parts = from_date.split('.')
                            if len(parts) == 2 and len(parts[0]) == 2 and len(parts[1]) == 6:
                                day = parts[0]
                                month = parts[1][:2]
                                year = parts[1][2:]
                                from_date = f"{day}.{month}.{year}"
                    
                    if to_date:
                        to_date = to_date.replace('-', '.') if to_date not in ['-', ''] else None
                        if to_date and 'till date' in to_date.lower():
                            to_date = "Till date"
                        elif to_date and len(to_date) == 9 and to_date.count('.') == 1:
                            parts = to_date.split('.')
                            if len(parts) == 2 and len(parts[0]) == 2 and len(parts[1]) == 6:
                                day = parts[0]
                                month = parts[1][:2]
                                year = parts[1][2:]
                                to_date = f"{day}.{month}.{year}"
                    
                    auditee_officer = {
                        "Auditee_Officer_Name": name,
                        "Audit_Officer_Designation": designation,
                        "Worked_From": from_date if from_date and from_date != '-' else None,
                        "Worked_Until": to_date if to_date and to_date != '-' else None
                    }
                    auditee_officers.append(auditee_officer)

def process_bdo_table(table_data, auditee_officers):
    """Process BDO tables with multiple sub-sections (B.P and V.P)"""
    if len(table_data) < 3:  # Need at least header + sub-header + data
        return
    
    current_designation = None
    header_indices = {"sl": None, "name": None, "from": None, "to": None}
    
    for i, row in enumerate(table_data):
        row_text = ' '.join([cell.lower().strip() for cell in row])
        
        # Check if this row contains designation info (BDO type)
        if 'bdo(b.p)' in row_text or 'bdo(v.p)' in row_text:
            if 'bdo(b.p)' in row_text:
                current_designation = "Block Development Officer (B.P)"
            elif 'bdo(v.p)' in row_text:
                current_designation = "Block Development Officer (V.P)"
        
        # Check if this is a header row with From/To columns
        if 'from' in row_text and 'to' in row_text:
            # Reset header indices
            header_indices = {"sl": None, "name": None, "from": None, "to": None}
            
            for j, cell in enumerate(row):
                cell_lower = cell.lower().strip()
                if ('sl' in cell_lower or 'no' in cell_lower) and header_indices["sl"] is None:
                    header_indices["sl"] = j
                elif 'name' in cell_lower and header_indices["name"] is None:
                    header_indices["name"] = j
                elif 'from' in cell_lower and header_indices["from"] is None:
                    header_indices["from"] = j
                elif 'to' in cell_lower and header_indices["to"] is None:
                    header_indices["to"] = j
        
        # Process data rows (after we have header indices and designation)
        elif (current_designation and 
              all(idx is not None for idx in header_indices.values()) and
              len(row) > max(header_indices.values())):
            
            # Skip rows that look like headers
            if any(header_word in row_text for header_word in ['sl.', 'name', 'from', 'to', 'period']):
                continue
            
            name = row[header_indices["name"]].strip() if header_indices["name"] < len(row) else ""
            from_date = row[header_indices["from"]].strip() if header_indices["from"] < len(row) else ""
            to_date = row[header_indices["to"]].strip() if header_indices["to"] < len(row) else ""
            
            # Clean up the name (remove numbering and extra formatting)
            name = re.sub(r'^\d+\.?\s*', '', name).strip()
            
            # Skip empty names or header-like entries
            if (name and 
                not any(skip_word in name.lower() for skip_word in ['name', 'sl.', 'sr.', 'no.', 'from', 'to']) and
                len(name) > 2):
                
                # Clean dates
                if from_date and from_date not in ['-', '']:
                    from_date = from_date.replace('-', '.')
                else:
                    from_date = None
                
                if to_date and to_date not in ['-', '']:
                    to_date = to_date.replace('-', '.')
                    if 'till date' in to_date.lower():
                        to_date = "Till date"
                else:
                    to_date = None
                
                auditee_officer = {
                    "Auditee_Officer_Name": name,
                    "Audit_Officer_Designation": current_designation,
                    "Worked_From": from_date,
                    "Worked_Until": to_date
                }
                auditee_officers.append(auditee_officer)
    
    return auditee_officers

def extract_officer_details_from_part_i(lines):
    """Extract audit officer details from HTML tables after supervision sentences throughout the document"""
    officers = []
    
    # Strategy: Look for HTML tables after specific sentences anywhere in the document
    # Join all lines to create a single text block for easier parsing
    full_content = '\n'.join(lines)
    
    # Look for key sentences that indicate officer tables follow
    key_sentences = [
        "by the following members of field audit party",
        "the audit was supervised by the following officers",
        "supervised by the following officers",
        "conducted by the following members",
        "audit team members"
    ]
    
    # Find positions of key sentences
    sentence_positions = []
    for sentence in key_sentences:
        start = 0
        while True:
            pos = full_content.lower().find(sentence, start)
            if pos == -1:
                break
            sentence_positions.append(pos)
            start = pos + 1
    
    if not sentence_positions:
        return officers
    
    # Parse HTML tables using HTMLParser
    from html.parser import HTMLParser
    
    class TableExtractor(HTMLParser):
        def __init__(self):
            super().__init__()
            self.tables = []
            self.current_table = []
            self.current_row = []
            self.current_cell = ""
            self.in_table = False
            self.in_row = False
            self.in_cell = False
            self.table_start_pos = 0
            self.char_count = 0
            
        def handle_starttag(self, tag, attrs):
            if tag.lower() == 'table':
                self.in_table = True
                self.current_table = []
                self.table_start_pos = self.char_count
            elif tag.lower() == 'tr' and self.in_table:
                self.in_row = True
                self.current_row = []
            elif tag.lower() in ['td', 'th'] and self.in_row:
                self.in_cell = True
                self.current_cell = ""
                
        def handle_endtag(self, tag):
            if tag.lower() == 'table' and self.in_table:
                if self.current_table:
                    self.tables.append({
                        'data': self.current_table,
                        'position': self.table_start_pos
                    })
                self.in_table = False
            elif tag.lower() == 'tr' and self.in_row:
                if self.current_row:
                    self.current_table.append(self.current_row)
                self.in_row = False
            elif tag.lower() in ['td', 'th'] and self.in_cell:
                self.current_row.append(self.current_cell.strip())
                self.in_cell = False
                
        def handle_data(self, data):
            self.char_count += len(data)
            if self.in_cell:
                self.current_cell += data
    
    parser = TableExtractor()
    parser.feed(full_content)
    
    # Find tables that appear after the key sentences
    relevant_tables = []
    for table_info in parser.tables:
        table_pos = table_info['position']
        table_data = table_info['data']
        
        # Check if this table appears after any of the key sentences
        for sent_pos in sentence_positions:
            if table_pos > sent_pos and table_pos - sent_pos < 1000:  # Within reasonable distance
                relevant_tables.append(table_data)
                break
    
    # If no tables found near sentences, use all tables with officer-like structure
    if not relevant_tables:
        relevant_tables = [table_info['data'] for table_info in parser.tables]
    
    # Process the relevant tables
    for table_data in relevant_tables:
        if len(table_data) >= 2:  # Must have header + at least 1 data row
            headers = [h.lower().strip() for h in table_data[0]]
            
            # Check if this is an officer table
            has_name = any('name' in header for header in headers)
            has_designation = any('designation' in header for header in headers)
            
            if has_name and has_designation:
                # Find column indices
                name_col = None
                designation_col = None
                from_col = None
                till_col = None
                
                for i, header in enumerate(headers):
                    if 'name' in header:
                        name_col = i
                    elif 'designation' in header:
                        designation_col = i
                    elif 'member from' in header or 'effective from' in header or 'from' in header:
                        from_col = i
                    elif 'member till' in header or 'member to' in header or 'effective to' in header or 'till' in header or 'to' in header:
                        till_col = i
                
                # Extract officer data
                for row in table_data[1:]:  # Skip header
                    if len(row) > max(name_col or 0, designation_col or 0):
                        name = row[name_col].strip() if name_col is not None and name_col < len(row) else ""
                        designation = row[designation_col].strip() if designation_col is not None and designation_col < len(row) else ""
                        member_from = row[from_col].strip() if from_col is not None and from_col < len(row) else None
                        member_until = row[till_col].strip() if till_col is not None and till_col < len(row) else None
                        
                        if name:
                            # Clean up the name (remove any numbering)
                            name = re.sub(r'^\d+\.\s*', '', name).strip()
                            
                            # Skip header-like entries
                            if not any(skip_word in name.lower() for skip_word in ['name', 'sl.', 'sr.', 'no.']):
                                officer = {
                                    "Audit_Officer_Name": name,
                                    "Audit_Officer_Designation": designation if designation else None,
                                    "Member_From": member_from if member_from and member_from != '-' else None,
                                    "Member_Until": member_until if member_until and member_until != '-' else None
                                }
                                officers.append(officer)
    
    return officers

def extract_dates_of_audit(lines):
    """Extract inspection/audit dates in DD/MM/YYYY or DD.MM.YYYY format from Part I content, specific date patterns, or scope content"""
    
    # First, look for Part I content and check first paragraph
    part_i_start = None
    for i, line in enumerate(lines):
        line_lower = line.lower().strip()
        if 'part' in line_lower and ('i' in line_lower or '1' in line_lower) and line.startswith('#'):
            part_i_start = i
            break
    
    # Check first paragraph of Part I for inspection dates
    if part_i_start is not None:
        for j in range(part_i_start + 1, min(part_i_start + 10, len(lines))):
            para_text = lines[j].strip()
            if not para_text or para_text.startswith('#'):
                continue
            
            # Pattern 1: "conducted from DD/MM/YYYY to DD/MM/YYYY"
            conducted_pattern = re.search(
                r"conducted from\s+(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})\s+to\s+(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})", 
                para_text, re.IGNORECASE
            )
            if conducted_pattern:
                return conducted_pattern.group(1).strip(), conducted_pattern.group(2).strip()
            
            # Pattern 2: "audit was conducted from DD/MM/YYYY to DD/MM/YYYY"
            audit_conducted_pattern = re.search(
                r"audit.*?conducted from\s+(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})\s+to\s+(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})", 
                para_text, re.IGNORECASE
            )
            if audit_conducted_pattern:
                return audit_conducted_pattern.group(1).strip(), audit_conducted_pattern.group(2).strip()
            
            # Pattern 3: "from DD/MM/YYYY to DD/MM/YYYY by the following members"
            members_pattern = re.search(
                r"from\s+(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})\s+to\s+(\d{1,2}[/.-]\d{1,2}[/.-]\d{4}).*?members", 
                para_text, re.IGNORECASE
            )
            if members_pattern:
                return members_pattern.group(1).strip(), members_pattern.group(2).strip()
            
            # Pattern 4: "inspection was conducted from DD/MM/YYYY to DD/MM/YYYY"
            inspection_conducted_pattern = re.search(
                r"inspection.*?conducted from\s+(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})\s+to\s+(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})", 
                para_text, re.IGNORECASE
            )
            if inspection_conducted_pattern:
                return inspection_conducted_pattern.group(1).strip(), inspection_conducted_pattern.group(2).strip()
            
            # Pattern 5: "DD/MM/YYYY to DD/MM/YYYY" with audit/inspection context
            if any(keyword in para_text.lower() for keyword in ['audit', 'inspection', 'conducted']):
                date_pattern = re.search(
                    r"(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})\s+to\s+(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})", 
                    para_text, re.IGNORECASE
                )
                if date_pattern:
                    return date_pattern.group(1).strip(), date_pattern.group(2).strip()
            
            # Break after first substantial paragraph
            if len(para_text) > 50:
                break
    
    # Second, look for specific "DATES OF AUDIT:" patterns anywhere in the document
    for line in lines:
        line_stripped = line.strip()
        
        # Pattern 6: "DATES OF AUDIT: DD.MM.YYYY TO DD.MM.YYYY"
        dates_audit_pattern = re.search(
            r"dates?\s+of\s+audit\s*:\s*(\d{1,2}[./]\d{1,2}[./]\d{4})\s+to\s+(\d{1,2}[./]\d{1,2}[./]\d{4})", 
            line_stripped, re.IGNORECASE
        )
        if dates_audit_pattern:
            return dates_audit_pattern.group(1).strip(), dates_audit_pattern.group(2).strip()
        
        # Pattern 7: "DATE OF AUDIT: DD.MM.YYYY TO DD.MM.YYYY"
        date_audit_pattern = re.search(
            r"date\s+of\s+audit\s*:\s*(\d{1,2}[./]\d{1,2}[./]\d{4})\s+to\s+(\d{1,2}[./]\d{1,2}[./]\d{4})", 
            line_stripped, re.IGNORECASE
        )
        if date_audit_pattern:
            return date_audit_pattern.group(1).strip(), date_audit_pattern.group(2).strip()
        
        # Pattern 8: "AUDIT DATE: DD.MM.YYYY TO DD.MM.YYYY"
        audit_date_pattern = re.search(
            r"audit\s+date\s*:\s*(\d{1,2}[./]\d{1,2}[./]\d{4})\s+to\s+(\d{1,2}[./]\d{1,2}[./]\d{4})", 
            line_stripped, re.IGNORECASE
        )
        if audit_date_pattern:
            return audit_date_pattern.group(1).strip(), audit_date_pattern.group(2).strip()
        
        # Pattern 9: "INSPECTION DATE: DD.MM.YYYY TO DD.MM.YYYY"
        inspection_date_pattern = re.search(
            r"inspection\s+date\s*:\s*(\d{1,2}[./]\d{1,2}[./]\d{4})\s+to\s+(\d{1,2}[./]\d{1,2}[./]\d{4})", 
            line_stripped, re.IGNORECASE
        )
        if inspection_date_pattern:
            return inspection_date_pattern.group(1).strip(), inspection_date_pattern.group(2).strip()
    
    # Third, check scope of audit content as fallback
    return extract_dates_from_scope_content(lines)

def extract_dates_from_scope_content(lines):
    """Extract date information from scope of audit content"""
    scope_content = ""
    
    # Find scope of audit section
    for i, line in enumerate(lines):
        line_lower = line.lower().strip()
        if any(keyword in line_lower for keyword in ['scope of audit', 'audit scope', 'scope and methodology']):
            # Extract content from this section (next 10-15 lines)
            scope_lines = []
            for j in range(i + 1, min(i + 16, len(lines))):
                next_line = lines[j].strip()
                if next_line and not next_line.startswith('#'):
                    scope_lines.append(next_line)
                elif next_line.startswith('##') or next_line.startswith('###'):
                    break
            scope_content = " ".join(scope_lines)
            break
    
    if not scope_content:
        return None, None
    
    # Look for date patterns in scope content
    # Pattern 1: "conducted from DD/MM/YYYY to DD/MM/YYYY"
    conducted_pattern = re.search(
        r"conducted from\s+(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})\s+to\s+(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})", 
        scope_content, re.IGNORECASE
    )
    if conducted_pattern:
        return conducted_pattern.group(1).strip(), conducted_pattern.group(2).strip()
    
    # Pattern 2: "from DD/MM/YYYY to DD/MM/YYYY"
    from_to_pattern = re.search(
        r"from\s+(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})\s+to\s+(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})", 
        scope_content, re.IGNORECASE
    )
    if from_to_pattern:
        return from_to_pattern.group(1).strip(), from_to_pattern.group(2).strip()
    
    # Pattern 3: "DD/MM/YYYY to DD/MM/YYYY" (general date range)
    date_range_pattern = re.search(
        r"(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})\s+to\s+(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})", 
        scope_content, re.IGNORECASE
    )
    if date_range_pattern:
        return date_range_pattern.group(1).strip(), date_range_pattern.group(2).strip()
    
    return None, None

def extract_period_from_scope_content(lines):
    """Extract period information from scope of audit content"""
    scope_content = ""
    
    # Enhanced scope of audit heading patterns
    scope_patterns = [
        r"Scope\s+of\s+Audit",
        r"SCOPE\s+OF\s+AUDIT",
        r"Scope\s+and\s+Methodology\s+of\s+Audit",
        r"SCOPE\s+AND\s+METHODOLOGY\s+OF\s+AUDIT",
        r"Scope\s+of\s+Audit:",
        r"SCOPE\s+OF\s+AUDIT:",
        r"Audit\s+Scope",
        r"AUDIT\s+SCOPE"
    ]
    
    # Find scope of audit section using enhanced patterns
    for i, line in enumerate(lines):
        line_stripped = line.strip()
        
        # Check if line matches any of the scope patterns
        scope_match = False
        for pattern in scope_patterns:
            if re.search(pattern, line_stripped, re.IGNORECASE):
                scope_match = True
                break
        
        # Also check for #### headings with scope patterns
        if line_stripped.startswith('####'):
            # Remove #### and check the remaining text
            heading_text = re.sub(r'^#{4,}\s*', '', line_stripped).strip()
            for pattern in scope_patterns:
                if re.search(pattern, heading_text, re.IGNORECASE):
                    scope_match = True
                    break
        
        # Also check for legacy patterns to maintain backward compatibility
        line_lower = line_stripped.lower()
        if scope_match or any(keyword in line_lower for keyword in ['scope of audit', 'audit scope', 'scope and methodology']):
            # Extract content from this section (next 10-15 lines)
            scope_lines = []
            for j in range(i + 1, min(i + 16, len(lines))):
                next_line = lines[j].strip()
                if next_line and not next_line.startswith('#'):
                    scope_lines.append(next_line)
                elif next_line.startswith('##') or next_line.startswith('###') or next_line.startswith('####'):
                    break
            scope_content = " ".join(scope_lines)
            break
    
    if not scope_content:
        return None, None
    
    # Month name patterns (full and abbreviated)
    months = {
        'jan': 'January', 'january': 'January',
        'feb': 'February', 'february': 'February', 
        'mar': 'March', 'march': 'March',
        'apr': 'April', 'april': 'April',
        'may': 'May',
        'jun': 'June', 'june': 'June',
        'jul': 'July', 'july': 'July',
        'aug': 'August', 'august': 'August',
        'sep': 'September', 'september': 'September', 'sept': 'September',
        'oct': 'October', 'october': 'October',
        'nov': 'November', 'november': 'November',
        'dec': 'December', 'december': 'December'
    }
    
    def normalize_month(month_str):
        if not month_str:
            return month_str
        month_lower = month_str.lower()
        return months.get(month_lower, month_str.upper())
    
    def format_date(month, year):
        if month and year:
            normalized_month = normalize_month(month)
            return f"{normalized_month} {year}"
        elif year:
            return year
        return None
    
    # Try patterns to extract period from scope
    # Pattern 1: "period from [month] [year] to [month] [year]"
    pattern1 = r"period\s+from\s+([A-Za-z]+)\s+(\d{4})\s+to\s+([A-Za-z]+)\s+(\d{4})"
    match1 = re.search(pattern1, scope_content, re.IGNORECASE)
    if match1:
        start_month, start_year, end_month, end_year = match1.groups()
        return format_date(start_month, start_year), format_date(end_month, end_year)
    
    # Pattern 2: "from [month] [year] to [month] [year]"
    pattern2 = r"from\s+([A-Za-z]+)\s+(\d{4})\s+to\s+([A-Za-z]+)\s+(\d{4})"
    match2 = re.search(pattern2, scope_content, re.IGNORECASE)
    if match2:
        start_month, start_year, end_month, end_year = match2.groups()
        return format_date(start_month, start_year), format_date(end_month, end_year)
    
    # Pattern 2a: "period from YYYY-YY to YYYY-YY" (financial year format)
    pattern2a = r"period\s+from\s+(\d{4})\s*[-–]\s*(\d{2})\s+to\s+(\d{4})\s*[-–]\s*(\d{2})"
    match2a = re.search(pattern2a, scope_content, re.IGNORECASE)
    if match2a:
        start_year = match2a.group(1)
        start_year_short = match2a.group(2)
        end_year = match2a.group(3)
        end_year_short = match2a.group(4)
        return f"{start_year}-{start_year_short}", f"{end_year}-{end_year_short}"
    
    # Pattern 3: "period [year] to [year]" or "period [year]-[year]"
    pattern3 = r"period\s+(\d{4})\s+to\s+(\d{4})|period\s+(\d{4})\s*[-–]\s*(\d{4})"
    match3 = re.search(pattern3, scope_content, re.IGNORECASE)
    if match3:
        if match3.group(1) and match3.group(2):
            return match3.group(1), match3.group(2)
        elif match3.group(3) and match3.group(4):
            return match3.group(3), match3.group(4)
    
    # Pattern 4: "covering [month] [year] to [month] [year]"
    pattern4 = r"covering\s+([A-Za-z]+)\s+(\d{4})\s+to\s+([A-Za-z]+)\s+(\d{4})"
    match4 = re.search(pattern4, scope_content, re.IGNORECASE)
    if match4:
        start_month, start_year, end_month, end_year = match4.groups()
        return format_date(start_month, start_year), format_date(end_month, end_year)
    
    # Pattern 5: "[year] to [year]" or "[year]-[year]"
    pattern5 = r"(\d{4})\s+to\s+(\d{4})|(\d{4})\s*[-–]\s*(\d{4})"
    match5 = re.search(pattern5, scope_content, re.IGNORECASE)
    if match5:
        if match5.group(1) and match5.group(2):
            return match5.group(1), match5.group(2)
        elif match5.group(3) and match5.group(4):
            return match5.group(3), match5.group(4)
    
    # Pattern 6: "for [year]-[yy]" (financial year format)
    pattern6 = r"for\s+(\d{4})\s*[-–]\s*(\d{2})"
    match6 = re.search(pattern6, scope_content, re.IGNORECASE)
    if match6:
        start_year = match6.group(1)
        end_year_short = match6.group(2)
        end_year = start_year[:2] + end_year_short
        return start_year, end_year
    
    # Pattern 7: "the year YYYY-YY" format in scope
    pattern7 = r"(?:the\s+year\s+|year\s+)(\d{4})\s*[-–]\s*(\d{2})"
    match7 = re.search(pattern7, scope_content, re.IGNORECASE)
    if match7:
        start_year = match7.group(1)
        end_year_short = match7.group(2)
        end_year = start_year[:2] + end_year_short
        return start_year, end_year
    
    return None, None

def extract_audit_year_and_state_from_heading(heading):
    """Extract audit years and state from heading using comprehensive date patterns"""
    if not heading:
        return [], None
    
    # Month name patterns (full and abbreviated)
    months = {
        'jan': 'January', 'january': 'January',
        'feb': 'February', 'february': 'February', 
        'mar': 'March', 'march': 'March',
        'apr': 'April', 'april': 'April',
        'may': 'May',
        'jun': 'June', 'june': 'June',
        'jul': 'July', 'july': 'July',
        'aug': 'August', 'august': 'August',
        'sep': 'September', 'september': 'September', 'sept': 'September',
        'oct': 'October', 'october': 'October',
        'nov': 'November', 'november': 'November',
        'dec': 'December', 'december': 'December'
    }
    
    # Helper function to normalize month names
    def normalize_month(month_str):
        if not month_str:
            return month_str
        month_lower = month_str.lower()
        return months.get(month_lower, month_str.upper())
    
    # Helper function to format date
    def format_date(month, year):
        if month and year:
            normalized_month = normalize_month(month)
            return f"{normalized_month} {year}"
        elif year:
            return year
        return None
    
    # Try all patterns to extract period information
    period_from, period_to = None, None
    
    # Pattern 0: "for the period YYYY-YYYY to YYYY-YYYY" (handle full year ranges first)
    pattern0 = r"(?:for\s+the\s+period\s+|period\s+)(\d{4})\s*-\s*(\d{4})\s+to\s+(\d{4})\s*-\s*(\d{4})"
    match0 = re.search(pattern0, heading, re.IGNORECASE)
    if match0:
        start_year1, start_year2, end_year1, end_year2 = match0.groups()
        period_from = f"{start_year1}-{start_year2}"
        period_to = f"{end_year1}-{end_year2}"
    
    # Pattern 1: "FOR THE PERIOD FROM [MONTH] [YEAR] TO [MONTH] [YEAR]"
    if not period_from:
        pattern1 = r"FOR\s+THE\s+PERIOD\s+FROM\s+([A-Za-z]+)\s+(\d{4})\s+TO\s+([A-Za-z]+)\s+(\d{4})"
        match1 = re.search(pattern1, heading, re.IGNORECASE)
        if match1:
            start_month, start_year, end_month, end_year = match1.groups()
            period_from = format_date(start_month, start_year)
            period_to = format_date(end_month, end_year)
    
    # Pattern 2: "FOR THE PERIOD [MONTH] [YEAR] TO [MONTH] [YEAR]" (without FROM)
    if not period_from:
        pattern2 = r"FOR\s+THE\s+PERIOD\s+([A-Za-z]+)\s+(\d{4})\s+TO\s+([A-Za-z]+)\s+(\d{4})"
        match2 = re.search(pattern2, heading, re.IGNORECASE)
        if match2:
            start_month, start_year, end_month, end_year = match2.groups()
            period_from = format_date(start_month, start_year)
            period_to = format_date(end_month, end_year)
    
    # Pattern 3: "FROM [MONTH] [YEAR] TO [MONTH] [YEAR]" (standalone FROM)
    if not period_from:
        pattern3 = r"FROM\s+([A-Za-z]+)\s+(\d{4})\s+TO\s+([A-Za-z]+)\s+(\d{4})"
        match3 = re.search(pattern3, heading, re.IGNORECASE)
        if match3:
            start_month, start_year, end_month, end_year = match3.groups()
            period_from = format_date(start_month, start_year)
            period_to = format_date(end_month, end_year)
    
    # Pattern 4: "PERIOD FROM [YEAR] TO [YEAR]" (years only)
    if not period_from:
        pattern4 = r"PERIOD\s+FROM\s+(\d{4})\s+TO\s+(\d{4})"
        match4 = re.search(pattern4, heading, re.IGNORECASE)
        if match4:
            start_year, end_year = match4.groups()
            period_from = start_year
            period_to = end_year
    
    # Pattern 5: "[YEAR] TO [YEAR]" or "[YEAR]-[YEAR]" (simple year ranges)
    if not period_from:
        pattern5 = r"(\d{4})\s+TO\s+(\d{4})|(\d{4})\s*[-–]\s*(\d{4})"
        match5 = re.search(pattern5, heading, re.IGNORECASE)
        if match5:
            if match5.group(1) and match5.group(2):  # "YEAR TO YEAR" format
                period_from = match5.group(1)
                period_to = match5.group(2)
            elif match5.group(3) and match5.group(4):  # "YEAR-YEAR" format
                period_from = match5.group(3)
                period_to = match5.group(4)
    
    # Pattern 6: "FOR [YEAR]-[YY]" (short year format like 2019-20)
    if not period_from:
        pattern6 = r"FOR\s+(\d{4})\s*[-–]\s*(\d{2})"
        match6 = re.search(pattern6, heading, re.IGNORECASE)
        if match6:
            start_year = match6.group(1)
            end_year_short = match6.group(2)
            end_year = start_year[:2] + end_year_short
            period_from = start_year
            period_to = end_year
    
    # Pattern 7: "DURING [YEAR]" or "IN [YEAR]" (single year)
    if not period_from:
        pattern7 = r"(?:DURING|IN)\s+(\d{4})"
        match7 = re.search(pattern7, heading, re.IGNORECASE)
        if match7:
            year = match7.group(1)
            period_from = year
            period_to = year
    
    # Pattern 8: "[DD/MM/YYYY] TO [DD/MM/YYYY]" (full date format)
    if not period_from:
        pattern8 = r"(\d{1,2})/(\d{1,2})/(\d{4})\s+TO\s+(\d{1,2})/(\d{1,2})/(\d{4})"
        match8 = re.search(pattern8, heading, re.IGNORECASE)
        if match8:
            start_day, start_month_num, start_year = match8.group(1), match8.group(2), match8.group(3)
            end_day, end_month_num, end_year = match8.group(4), match8.group(5), match8.group(6)
            
            # Convert month numbers to month names
            month_names = ['', 'January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December']
            start_month_name = month_names[int(start_month_num)] if 1 <= int(start_month_num) <= 12 else start_month_num
            end_month_name = month_names[int(end_month_num)] if 1 <= int(end_month_num) <= 12 else end_month_num
            
            period_from = f"{start_day} {start_month_name} {start_year}"
            period_to = f"{end_day} {end_month_name} {end_year}"
    
    # Pattern 9: "FROM [DD/MM/YYYY] TO [DD/MM/YYYY]"
    if not period_from:
        pattern9 = r"FROM\s+(\d{1,2})/(\d{1,2})/(\d{4})\s+TO\s+(\d{1,2})/(\d{1,2})/(\d{4})"
        match9 = re.search(pattern9, heading, re.IGNORECASE)
        if match9:
            start_day, start_month_num, start_year = match9.group(1), match9.group(2), match9.group(3)
            end_day, end_month_num, end_year = match9.group(4), match9.group(5), match9.group(6)
            
            month_names = ['', 'January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December']
            start_month_name = month_names[int(start_month_num)] if 1 <= int(start_month_num) <= 12 else start_month_num
            end_month_name = month_names[int(end_month_num)] if 1 <= int(end_month_num) <= 12 else end_month_num
            
            period_from = f"{start_day} {start_month_name} {start_year}"
            period_to = f"{end_day} {end_month_name} {end_year}"
    
    # Pattern 10: "FINANCIAL YEAR [YYYY-YY]"
    if not period_from:
        pattern10 = r"FINANCIAL\s+YEAR\s+(\d{4})\s*[-–]\s*(\d{2})"
        match10 = re.search(pattern10, heading, re.IGNORECASE)
        if match10:
            start_year = match10.group(1)
            end_year_short = match10.group(2)
            end_year = start_year[:2] + end_year_short
            period_from = f"April {start_year}"
            period_to = f"March {end_year}"
    
    # Pattern 11: Generic month-year patterns without specific keywords
    if not period_from:
        pattern11 = r"([A-Za-z]+)\s+(\d{4})\s+(?:TO|[-–])\s+([A-Za-z]+)\s+(\d{4})"
        match11 = re.search(pattern11, heading, re.IGNORECASE)
        if match11:
            start_month, start_year, end_month, end_year = match11.groups()
            # Only proceed if the first and third groups look like month names
            if (start_month.lower() in months or len(start_month) >= 3) and \
               (end_month.lower() in months or len(end_month) >= 3):
                period_from = format_date(start_month, start_year)
                period_to = format_date(end_month, end_year)
    
    # Pattern 12: "FOR THE YEARS YYYY-YY AND YYYY-YY" (financial year ranges)
    if not period_from:
        pattern12 = r"(?:FOR\s+THE\s+|THE\s+)?YEARS?\s+(\d{4})\s*[-–]\s*(\d{2})\s+AND\s+(\d{4})\s*[-–]\s*(\d{2})"
        match12 = re.search(pattern12, heading, re.IGNORECASE)
        if match12:
            start_year1 = match12.group(1)  # First year (e.g., 2022)
            end_year1_short = match12.group(2)  # First year ending (e.g., 23)
            start_year2 = match12.group(3)  # Second year (e.g., 2023)
            end_year2_short = match12.group(4)  # Second year ending (e.g., 24)
            
            # Return financial year format for the range
            period_from = f"{start_year1}-{end_year1_short}"
            period_to = f"{start_year2}-{end_year2_short}"
    
    # Pattern 13: "the year YYYY-YY" format - convert to separate years
    if not period_from:
        pattern13 = r"(?:the\s+year\s+|year\s+)(\d{4})\s*[-–]\s*(\d{2})"
        match13 = re.search(pattern13, heading, re.IGNORECASE)
        if match13:
            start_year = match13.group(1)
            end_year_short = match13.group(2)
            end_year = start_year[:2] + end_year_short
            period_from = start_year
            period_to = end_year
    
    # Pattern 14: "the period YYYY-YY to YYYY-YY" format
    if not period_from:
        pattern14 = r"(?:the\s+period\s+|period\s+)(\d{4})\s*[-–]\s*(\d{2})\s+to\s+(\d{4})\s*[-–]\s*(\d{2})"
        match14 = re.search(pattern14, heading, re.IGNORECASE)
        if match14:
            start_year = match14.group(1)
            start_year_short = match14.group(2)
            end_year = match14.group(3)
            end_year_short = match14.group(4)
            period_from = f"{start_year}-{start_year_short}"
            period_to = f"{end_year}-{end_year_short}"
    
    # Pattern 15: Simple "YYYY-YY to YYYY-YY" format (like 2020-21 to 2022-23)
    if not period_from:
        pattern15 = r"(\d{4})\s*[-–]\s*(\d{2})\s+to\s+(\d{4})\s*[-–]\s*(\d{2})"
        match15 = re.search(pattern15, heading, re.IGNORECASE)
        if match15:
            start_year = match15.group(1)
            start_year_short = match15.group(2)
            end_year = match15.group(3)
            end_year_short = match15.group(4)
            period_from = f"{start_year}-{start_year_short}"
            period_to = f"{end_year}-{end_year_short}"
    
    # Pattern 16: "YYYY-YY" single financial year format - convert to separate years
    if not period_from:
        pattern16 = r"(?:^|\s)(\d{4})\s*[-–]\s*(\d{2})(?:\s|$)"
        match16 = re.search(pattern16, heading, re.IGNORECASE)
        if match16:
            start_year = match16.group(1)
            end_year_short = match16.group(2)
            end_year = start_year[:2] + end_year_short
            period_from = start_year
            period_to = end_year
    
    # Create audit_years list from extracted periods
    audit_years = []
    if period_from and period_to:
        if period_from != period_to:
            audit_years = [period_from, period_to]
        else:
            audit_years = [period_from]
    elif period_from:
        audit_years = [period_from]
    
    # Look for state names (add more as needed)
    state = None
    states = [
        "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi", "Puducherry", "Jammu and Kashmir", "Ladakh"
    ]
    for s in states:
        if s.lower() in heading.lower():
            state = s
            break
    
    return audit_years, state

def process_markdown_file(doc_path):
    file_id = os.path.splitext(os.path.basename(doc_path))[0]
    with open(doc_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    metadata = extract_metadata_from_lines(lines)
    if not metadata["document_name"]:
        metadata["document_name"] = file_id

    # Find document heading and extract audit year/state if present
    heading_line_idx = None
    detected_state = None
    for idx, line in enumerate(lines):
        if line.strip().startswith('# '):
            heading = line.strip()[2:].strip()
            metadata["document_heading"] = heading
            audit_years, state = extract_audit_year_and_state_from_heading(heading)
            
            # Extract period information and set audit periods
            if audit_years:
                if len(audit_years) >= 2:
                    metadata["Period_of_audit"]["Period_From"] = audit_years[0]
                    metadata["Period_of_audit"]["Period_To"] = audit_years[-1]
                elif len(audit_years) == 1:
                    metadata["Period_of_audit"]["Period_From"] = audit_years[0]
                    metadata["Period_of_audit"]["Period_To"] = audit_years[0]
            
            if state:
                detected_state = state
            heading_line_idx = idx
            break
    
    # If no period found in heading, try to extract from lines below heading
    if not metadata["Period_of_audit"]["Period_From"]:
        below_heading_period_from, below_heading_period_to = extract_period_of_audit(lines, heading_line_idx)
        if below_heading_period_from and below_heading_period_to:
            metadata["Period_of_audit"]["Period_From"] = below_heading_period_from
            metadata["Period_of_audit"]["Period_To"] = below_heading_period_to
    
    # If still no period found, try to extract from scope of audit content
    if not metadata["Period_of_audit"]["Period_From"]:
        scope_period_from, scope_period_to = extract_period_from_scope_content(lines)
        if scope_period_from and scope_period_to:
            metadata["Period_of_audit"]["Period_From"] = scope_period_from
            metadata["Period_of_audit"]["Period_To"] = scope_period_to
    
    # State is now handled by hierarchy extraction in extract_metadata_from_lines()
    # Don't override the hierarchy-based state extraction
    pass
    
    # Extract Date_of_audit using comprehensive date patterns
    date_from, date_to = extract_dates_of_audit(lines)
    if date_from and date_to:
        metadata["Date_of_audit"]["Period_From"] = date_from
        metadata["Date_of_audit"]["Period_To"] = date_to
    elif date_from:  # Single date found
        metadata["Date_of_audit"]["Period_From"] = date_from
        metadata["Date_of_audit"]["Period_To"] = date_from
    
    # Extract Audit Officer Details from Part I tables
    officer_details = extract_officer_details_from_part_i(lines)
    if officer_details:
        metadata["Audit_Officer_Details"] = officer_details
    
    # Extract Auditee Officer Details from Part V tables
    auditee_details = extract_auditee_details_from_part_v(lines)
    if auditee_details:
        metadata["Auditee_Office_Details"] = auditee_details

    json_data = {
        "metadata": metadata,
        "parts": []
    }
    current_part = None
    current_section = None
    current_sub_section = None
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue
        # Table HTML block detection (handle nested tables)
        if '<table>' in line:
            table_lines = [line]
            table_open = line.count('<table>')
            table_close = line.count('</table>')
            i += 1
            while i < len(lines):
                table_open += lines[i].count('<table>')
                table_close += lines[i].count('</table>')
                table_lines.append(lines[i])
                if table_open > 0 and table_open == table_close:
                    i += 1
                    break
                i += 1
            # Preserve exact HTML table structure but remove newlines
            html_table = ''.join(table_lines).replace('\n', '')
            table_item = {"type": "table", "table": html_table}
            if current_sub_section is not None:
                current_sub_section["content"].append(table_item)
            elif current_section is not None:
                current_section["content"].append(table_item)
            elif current_part is not None:
                if not current_part["sections"]:
                    current_part["sections"].append({"section_title": "General", "content": [], "sub_sections": []})
                current_part["sections"][-1]["content"].append(table_item)
            continue
        if line.startswith('# '):
            # Already handled above for metadata, skip
            i += 1
        elif line.startswith('## '):
            current_part = {"part_title": line[3:].strip(), "sections": []}
            json_data["parts"].append(current_part)
            current_section = None
            current_sub_section = None
            i += 1
        elif line.startswith('### '):
            if current_part is None:
                current_part = {"part_title": "General", "sections": []}
                json_data["parts"].append(current_part)
            current_section = {"section_title": line[4:].strip(), "content": [], "sub_sections": []}
            current_part["sections"].append(current_section)
            current_sub_section = None
            i += 1
        elif line.startswith('#### '):
            if current_section is None:
                if current_part is None:
                    current_part = {"part_title": "General", "sections": []}
                    json_data["parts"].append(current_part)
                current_section = {"section_title": "General", "content": [], "sub_sections": []}
                current_part["sections"].append(current_section)
            current_sub_section = {"sub_section_title": line[5:].strip(), "content": []}
            current_section["sub_sections"].append(current_sub_section)
            i += 1
        elif '|' in line:
            # Markdown table block (as before)
            table_lines = []
            while i < len(lines) and '|' in lines[i]:
                if not re.match(r'^\s*\|(?:\s*:?---:?.*\|)+\s*$', lines[i]):
                    table_lines.append(lines[i])
                i += 1
            if table_lines:
                html_table = table_to_html(table_lines)
                table_item = {"type": "table", "table": html_table}
                if current_sub_section is not None:
                    current_sub_section["content"].append(table_item)
                elif current_section is not None:
                    current_section["content"].append(table_item)
                elif current_part is not None:
                    if not current_part["sections"]:
                        current_part["sections"].append({"section_title": "General", "content": [], "sub_sections": []})
                    current_part["sections"][-1]["content"].append(table_item)
        else:
            content_item = {"type": "paragraph", "text": line}
            if current_sub_section is not None:
                current_sub_section["content"].append(content_item)
            elif current_section is not None:
                current_section["content"].append(content_item)
            elif current_part is not None:
                if not current_part["sections"]:
                    current_part["sections"].append({"section_title": "General", "content": [], "sub_sections": []})
                current_part["sections"][-1]["content"].append(content_item)
            else:
                current_part = {"part_title": "General", "sections": []}
                json_data["parts"].append(current_part)
                current_section = {"section_title": "General", "content": [], "sub_sections": []}
                current_part["sections"].append(current_section)
                current_section["content"].append(content_item)
            i += 1
    return json_data

def main():
    import sys
    
    # Check for force overwrite flag
    force_overwrite = '--force' in sys.argv or '-f' in sys.argv
    
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    processed_count = 0
    skipped_count = 0
    excluded_count = 0
    
    for filename in os.listdir(DATA_DIR):
        if filename.endswith(".md"):
            # Skip test files and validation files
            if filename.startswith("test_") or filename.startswith("validation_"):
                print(f"Excluding {filename} - test/validation file")
                excluded_count += 1
                continue
            doc_path = os.path.join(DATA_DIR, filename)
            base_filename = os.path.splitext(filename)[0]
            output_path = os.path.join(OUTPUT_DIR, f"{base_filename}.json")
            
            # Skip processing if JSON file already exists (unless force flag is used)
            if os.path.exists(output_path) and not force_overwrite:
                print(f"Skipping {filename} - JSON already exists: {base_filename}.json")
                skipped_count += 1
                continue
                
            print(f"Processing {filename}...")
            try:
                structured_data = process_markdown_file(doc_path)
                # Convert to JSON string and then fix HTML attribute escaping in tables
                json_string = json.dumps(structured_data, indent=2, ensure_ascii=False)
                
                # Fix HTML attribute escaping specifically for table content
                # Simple approach: find and replace escaped quotes in HTML attributes within tables
                import re
                
                # Find lines that contain table content and unescape HTML attributes
                lines = json_string.split('\n')
                fixed_lines = []
                
                for line in lines:
                    if '"table":' in line and ('colspan=' in line or 'rowspan=' in line):
                        # This line contains table data with HTML attributes, unescape quotes
                        line = line.replace('\\"', '"')
                    fixed_lines.append(line)
                
                json_string = '\n'.join(fixed_lines)
                
                with open(output_path, 'w', encoding='utf-8') as f:
                    f.write(json_string)
                print(f"Successfully created structured JSON: {output_path}")
                processed_count += 1
            except Exception as e:
                print(f"Error processing {filename}: {e}")
    
    # Print summary
    print(f"\n=== PROCESSING SUMMARY ===")
    print(f"Files processed: {processed_count}")
    print(f"Files skipped: {skipped_count}")
    print(f"Files excluded: {excluded_count}")
    total_files = processed_count + skipped_count + excluded_count
    print(f"Total files: {total_files}")
    
    if force_overwrite:
        print("Mode: Force overwrite enabled")
    else:
        print("Mode: Skip existing files (use --force or -f to overwrite)")

if __name__ == "__main__":
    main()
