#
# Dev loop for the scheduling pipeline.
#
#   make test       — run all parser + feature tests (stdlib unittest)
#   make ingest     — parse inbox -> processed/
#   make features   — processed -> features/
#   make all        — ingest + features end-to-end
#   make smoke      — full pipeline against synthetic fixtures (hermetic)
#   make clean      — remove processed/, features/, smoke output
#
# No external dependencies. Runs on the stdlib Python 3.9+ that ships with
# macOS and every major Linux.
#
# Note: the repo's parent directory contains a trailing space
# (`BettyAgent `), so EVERY path expansion is double-quoted in the recipes.
# Do not strip the quotes.
#

PY ?= python3

HERE      := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
REPO      := $(abspath $(HERE)/../..)
BETTYAI   := $(REPO)/betty-ai
INBOX     := $(REPO)/raw/slurm_logs/inbox
PROCESSED := $(REPO)/raw/slurm_logs/processed
FEATURES  := $(BETTYAI)/data/features

SMOKE_INBOX := $(HERE)/.smoke/inbox
SMOKE_PROC  := $(HERE)/.smoke/processed
SMOKE_FEAT  := $(HERE)/.smoke/features

.PHONY: test ingest features all smoke clean

test:
	@cd "$(BETTYAI)" && PYTHONPATH="$(BETTYAI):$$PYTHONPATH" \
		$(PY) -m unittest discover -v -s scheduling/tests -t "$(BETTYAI)"

ingest:
	@mkdir -p "$(INBOX)" "$(PROCESSED)"
	@cd "$(BETTYAI)" && PYTHONPATH="$(BETTYAI):$$PYTHONPATH" \
		$(PY) -m scheduling.cli ingest "$(INBOX)" "$(PROCESSED)"

features:
	@mkdir -p "$(PROCESSED)" "$(FEATURES)"
	@cd "$(BETTYAI)" && PYTHONPATH="$(BETTYAI):$$PYTHONPATH" \
		$(PY) -m scheduling.cli features "$(PROCESSED)" "$(FEATURES)"

all: ingest features

smoke:
	@rm -rf "$(HERE)/.smoke"
	@mkdir -p "$(SMOKE_INBOX)" "$(SMOKE_PROC)" "$(SMOKE_FEAT)"
	@cp "$(HERE)"/fixtures/synthetic/* "$(SMOKE_INBOX)/"
	@cd "$(BETTYAI)" && PYTHONPATH="$(BETTYAI):$$PYTHONPATH" \
		$(PY) -m scheduling.cli all "$(SMOKE_INBOX)" "$(SMOKE_PROC)" "$(SMOKE_FEAT)"
	@echo ""
	@echo "[smoke] ok — artifacts:"
	@find "$(SMOKE_FEAT)" -type f -name '*.json' | sed 's/^/  /'

clean:
	@rm -rf "$(PROCESSED)" "$(FEATURES)" "$(HERE)/.smoke"
