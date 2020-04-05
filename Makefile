.PHONY: process
process: dl
	python etl.py

.PHONY: dl
dl:
	-git clone --depth=1 git@github.com:CSSEGISandData/COVID-19.git jhudata
	cd jhudata && git pull

.PHONY: publish
publish:
	git push
	-git branch -D gh-pages
	git checkout -b gh-pages
	git push -f -u origin gh-pages
	git checkout master

.PHONY: update
update: process
	git commit -m "update data $(shell date)" data.json
	make publish
