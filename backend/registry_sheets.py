import gspread
from oauth2client.service_account import ServiceAccountCredentials
import os
import datetime
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Expected Columns Mapping (0-indexed)
COL_PROJECT_ID = 0
COL_PROJECT_TITLE = 1
COL_SRS_LINK = 2
COL_SDD_LINK = 3
COL_STATUS = 4
COL_LAST_UPDATED = 5
COL_SRS_PATH = 6
COL_SDD_PATH = 7
COL_ERROR = 8

class RegistrySheetsService:
    def __init__(self, service_account_json_path=None, sheet_id=None, user_credentials=None):
        self.scope = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]
        
        if user_credentials:
            # Authenticate using user OAuth token
            self.client = gspread.authorize(user_credentials)
        elif service_account_json_path:
            # Fallback to Service Account
            self.creds = ServiceAccountCredentials.from_json_keyfile_name(service_account_json_path, self.scope)
            self.client = gspread.authorize(self.creds)
        else:
            raise ValueError("No authentication method provided (Service Account or User Credentials)")

        self.sheet_id = sheet_id
        self.workbook = None
        if sheet_id:
            try:
                self.workbook = self.client.open_by_key(sheet_id)
            except Exception as e:
                logger.error(f"Failed to open sheet {sheet_id}: {e}")

    def get_all_projects(self, sheet_name):
        """Fetch all rows from the sheet regardless of status"""
        try:
            worksheet = self.workbook.worksheet(sheet_name)
            all_records = worksheet.get_all_values()
            
            if not all_records:
                return []

            projects = []
            for idx, row in enumerate(all_records[1:], start=2):
                # Ensure row has enough columns
                if len(row) > COL_STATUS:
                    project = {
                        'row_index': idx,
                        'project_id': row[COL_PROJECT_ID] if len(row) > COL_PROJECT_ID else '',
                        'project_title': row[COL_PROJECT_TITLE] if len(row) > COL_PROJECT_TITLE else 'Untitled',
                        'srs_link': row[COL_SRS_LINK] if len(row) > COL_SRS_LINK else '',
                        'sdd_link': row[COL_SDD_LINK] if len(row) > COL_SDD_LINK else '',
                        'status': row[COL_STATUS],
                        'academic_year': sheet_name
                    }
                    projects.append(project)
            return projects
        except Exception as e:
            print(f"Error fetching projects from {sheet_name}: {e}")
            raise e

    def update_status(self, sheet_name, row_index, status, srs_path='', sdd_path='', error_msg=''):
        """Update the row with the current status and archival details"""
        worksheet = self.workbook.worksheet(sheet_name)
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Batch update for efficiency
        # Status (E), Last Updated (F), SRS Path (G), SDD Path (H), Error (I)
        # 1-indexed for cell names: A=1, B=2, C=3, D=4, E=5, F=6, G=7, H=8, I=9
        updates = [
            {'range': f'E{row_index}', 'values': [[status]]},
            {'range': f'F{row_index}', 'values': [[timestamp]]},
            {'range': f'G{row_index}', 'values': [[srs_path]]},
            {'range': f'H{row_index}', 'values': [[sdd_path]]},
            {'range': f'I{row_index}', 'values': [[error_msg]]}
        ]
        
        worksheet.batch_update(updates)
        logger.info(f"Updated row {row_index} in {sheet_name} with status: {status}")

    def get_all_sheet_names(self):
        """List all worksheet names in the workbook (e.g., '2024-2025', '2025-2026')"""
        return [ws.title for ws in self.workbook.worksheets()]

    def list_available_sheets(self):
        """List all Google Sheets files the service account can access"""
        # We use the underlying gspread client's auth session to call Drive API
        # Or just use gspread's openall() which might be slow if there are many files.
        # list_spreadsheet_files() is better.
        files = self.client.list_spreadsheet_files()
        return [{"id": f["id"], "name": f["name"]} for f in files]
