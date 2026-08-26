# Google Docs bridge

This private Apps Script lets Studio read and write native Google Docs in a folder you choose. The browser never receives its shared secret.

Deploy `Code.gs` as a web app that executes as the owner. Add these script properties before deployment:

- `FOLDER_ID`: the ID of a dedicated Google Drive folder for working drafts
- `BRIDGE_SECRET`: a unique random value stored separately as the Studio server secret

The deployment URL belongs in `WRITE_PLACID_DRIVE_BRIDGE_URL`. The same secret belongs in `WRITE_PLACID_DRIVE_BRIDGE_SECRET`.
