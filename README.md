# DHG 503 Project

## 10/02/2025

- Create the Docker container for the postgres database and initialize the database

## 17/02/2025

- Practice SQL basic queries

## 23/02/2025

- Web Crawling

## 10/03/2025

- Set up the project layout

### Project Layout

```
dhg503-project/
│
├── data/                        # Data storage
│   ├── raw/                     # Raw scraped data
│   ├── processed/               # Processed data
│   └── tmp/                     # Temporary data
│
├── logs/                        # Log files directory
│
├── notebooks/                   # Jupyter notebooks for only exploration
│   ├── crawling/                # Crawling experiments
│   ├── processing/              # Data processing experiments
│   └── analysis/                # Data analysis and visualization
│
├── src/
│   ├── __init__.py              # Make src a proper package
│   ├── utils/                   # Shared utilities
│   │   ├── __init__.py
│   │   ├── config.py            # Configuration utilities
│   │   └── logging.py           # Logging setup
│   │
│   ├── crawler/
│   │   ├── __init__.py
│   │   ├── spiders/
│   │   └── utils/
│   │
│   ├── processing/
│   │   ├── __init__.py
│   │   ├── cleaning.py
│   │   ├── transform.py
│   │   └── validate.py
│   │
│   ├── database/
│   │   ├── __init__.py
│   │   ├── schema.py
│   │   ├── db.py
│   │
│   └── api/
│       ├── __init__.py
│       ├── routes.py
│       └── server.py
│
├── scripts/                     # Utility scripts
│   ├── crawl.py                 # Script to run crawlers
│   ├── process.py               # Script to process data
│   └── serve.py                 # Script to start FastAPI server
│
├── config.yaml                  # Main configuration file
├── README.md                    # Project documentation
├── requirements.txt             # Project dependencies
├── .gitignore                   # Git ignore rules
├── .python-version              # Python version
├── pyproject.toml               # uv dependency manager
├── uv.lock                      # uv dependency lock file
├── docker-compose.yaml          # Docker Compose file
├── Dockerfile.db                # Dockerfile for the postgres
├── init.sql                     # First sql script to run
├── xpath_finder/                # XPath finder for the html parsing (Chrome extension)
└── README.md                    # Version history
```
