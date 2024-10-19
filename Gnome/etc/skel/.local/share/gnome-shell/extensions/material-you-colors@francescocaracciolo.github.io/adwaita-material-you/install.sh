#!/bin/bash
cd "$(dirname "$0")"
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
chmod +x "$(dirname "$0")/bin/adwmu"
sudo ln -s "$(pwd)/$(dirname "$0")/bin/adwmu" /usr/local/bin/adwmu