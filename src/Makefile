### To compile for all supported plaforms, type "make release"
### To compile for a specific OS (e.g. linux) run "make release-OS" (e.g. "make release-linux"
### If you use make that way, you'll find executables in ../releases

### This makefile can only be run on macos and linux 
###
### This makefile is not actually needed to build the software; it's
### just a set of shortcuts.  To compile on a specific OS of which you
### know the RID, run:
###
### dotnet build -c release -r RID
###
### For instance, to compile for windows, run
### dotnet build win-x64
###
### Currently supported RIDs are linux-x64, osx-x64, win-x64
###
### the program will be compiled in
### ./bin/release/netcoreapp2.x/win-x64/publish/voxlogica

PROJ=VoxLogicA
UNAME := $(shell uname)
VERSION=$(shell cat VERSION.txt)
RELEASENAME=$(PROJ)_$(VERSION)_$(RID)
RELEASE=../releases/$(RELEASENAME)
NET=net8.0

ifeq ($(VERSION),"") 
		$(error "VERSION is not set; set the release number (e.g. 0.5.1) in VERSION.txt") 
endif
	
.PHONY: build clean restore release-linux release-osx release-win publish-internal release upgrade

build: *.fs $(PROJ).fsproj
	TERM=xterm DOTNET_CLI_TELEMETRY_OPTOUT=1 dotnet build -c release

build-dbg: *.fs $(PROJ).fsproj
	TERM=xterm DOTNET_CLI_TELEMETRY_OPTOUT=1 dotnet build -c Debug

restore:
	TERM=xterm DOTNET_CLI_TELEMETRY_OPTOUT=1 dotnet restore

publish-internal:
	TERM=xterm DOTNET_CLI_TELEMETRY_OPTOUT=1 dotnet publish -c release -r $(RID)
	mkdir -p $(RELEASE)
	rm bin/release/$(NET)/$(RID)/publish/*.pdb
	cp -a bin/release/$(NET)/$(RID)/publish/* $(RELEASE)
	cp -a BINARY_LICENSE.txt $(RELEASE)
	cd ../releases && rm -f $(RELEASENAME).zip && zip -r $(RELEASENAME).zip $(RELEASENAME)

clean:
	rm -rf bin obj

cleanlib: clean
	rm -rf lib

release-linux:
	make publish-internal RID=linux-x64

release-osx:
	make publish-internal RID=osx-x64

release-win:
	make publish-internal RID=win-x64

release: release-linux release-osx release-win	

upload-release: release
	./upload_helper.sh

	
install-linux: release-linux
	#TODO: this is temporary; should be made portable
	echo sudo "cd /opt && $(PWD)/$(RELEASE)linux-x64.zip"	

upgrade: restore
	dotnet list package --outdated | grep ">"| cut -f 5 -d " " | xargs -l dotnet add package