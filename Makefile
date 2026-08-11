.PHONY: ui build install test clean

# Build the web UI (requires bun: https://bun.sh)
ui:
	go generate ./ui

# Build the lovr binary with the web UI embedded
build: ui
	go build -o lovr-bin ./lovr

# Install lovr (with the web UI embedded) into GOBIN
install: ui
	go install ./lovr

test:
	go test ./...

clean:
	rm -f lovr-bin
	mkdir -p ui/dist
	find ui/dist -mindepth 1 -not -name .gitkeep -delete
	touch ui/dist/.gitkeep
