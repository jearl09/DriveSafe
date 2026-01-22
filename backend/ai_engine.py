import os
import shutil
import re
import pdfplumber

def quick_predict_category_by_name(filename):
    """
    Very loose guesser to ensure Dashboard never says 'File' or 'Analyzing'.
    """
    name = filename.lower()
    
    # 1. ACADEMIC KEYWORDS
    academic_terms = ["srs", "sdd", "spmp", "std", "proposal", "manual", "thesis", "capstone", "documentation", "report", "paper", "project", "chapter"]
    if any(x in name for x in academic_terms):
        return "Academic"
        
    # 2. ACADEMIC EXTENSIONS (PDFs and Docs are usually academic in this context)
    if name.endswith(".pdf") or name.endswith(".docx") or name.endswith(".doc"):
        return "Academic"

    # 3. PERSONAL KEYWORDS
    personal_terms = ["jpg", "png", "jpeg", "mp4", "mov", "vacation", "party", "family", "screenshot", "img_", "dsc_"]
    if any(x in name for x in personal_terms):
        return "Personal"

    # 4. Fallback
    return "Work"

def scan_file_content(file_path):
    """
    Scans PDF content. If it fails, falls back gracefully.
    """
    filename = os.path.basename(file_path)
    text_content = ""
    
    # Defaults
    metadata = {
        "year": "2025-2026", 
        "team": None, # If None, we won't put it in the folder name
        "title": "Untitled_Project",
        "type": "General_Doc"
    }

    # READ PDF
    if file_path.lower().endswith('.pdf'):
        try:
            with pdfplumber.open(file_path) as pdf:
                for i, page in enumerate(pdf.pages):
                    if i > 2: break 
                    text = page.extract_text()
                    if text: text_content += text + "\n"
        except Exception:
            pass # Ignore errors, use defaults

    text_lower = text_content.lower()

    # 1. TYPE
    if "requirements" in text_lower or "srs" in text_lower: metadata["type"] = "SRS"
    elif "design" in text_lower or "sdd" in text_lower: metadata["type"] = "SDD"
    elif "project management" in text_lower or "spmp" in text_lower: metadata["type"] = "SPMP"
    elif "test" in text_lower or "std" in text_lower: metadata["type"] = "STD"
    elif "proposal" in text_lower: metadata["type"] = "Proposal"

    # 2. TITLE (Look for "for [TITLE]")
    title_match = re.search(r"\bfor\s*\n+\s*([A-Z0-9\s\-_]+)", text_content)
    if title_match:
        raw = title_match.group(1).split("Prepared")[0].strip()
        if len(raw) > 2 and "insert" not in raw.lower():
            metadata["title"] = raw.replace(" ", "_").upper()
    else:
        # Fallback to Filename
        clean = os.path.splitext(filename)[0]
        for word in ["SRS", "SDD", "Team", "16", "Group"]:
            clean = clean.replace(word, "", -1)
        if len(clean.strip()) > 0:
            metadata["title"] = clean.strip().replace(" ", "_").upper()

    # 3. TEAM
    team_match = re.search(r"(Team|Group)\s?[-#]?\s?(\d+)", text_content, re.IGNORECASE)
    if team_match:
        metadata["team"] = f"Team_{team_match.group(2)}"

    return metadata

def move_to_archive(source_path, metadata, base_folder_path):
    # SMART NAMING: 2026_PROJECT_TITLE (No Team # if not found)
    folder_name = f"{metadata['year']}_{metadata['title']}"
    if metadata['team']:
        folder_name += f"_{metadata['team']}"
    
    dest_folder = os.path.join(base_folder_path, folder_name)
    os.makedirs(dest_folder, exist_ok=True)
    
    # INFO.TXT
    info_path = os.path.join(dest_folder, "project_info.txt")
    if not os.path.exists(info_path):
        with open(info_path, "w") as f:
            f.write(f"Project: {metadata['title']}\n")
            if metadata['team']: f.write(f"Team: {metadata['team']}\n")
            f.write(f"Year: {metadata['year']}\n")

    # RENAME FILE: Type_Filename.pdf
    new_filename = f"{metadata['type']}_{os.path.basename(source_path)}"
    dest_path = os.path.join(dest_folder, new_filename)
    
    shutil.move(source_path, dest_path)
    return dest_path