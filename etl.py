#!/usr/bin/env python3
import csv
import glob
import os
import json


def country(row):
    if "Country/Region" in row:
        return row["Country/Region"]
    return row["Country_Region"]


def setcountry(row, val):
    if "Country/Region" in row:
        row["Country/Region"] = val
    else:
        row["Country_Region"] = val


def state(row):
    if "Province/State" in row:
        return row["Province/State"]
    return row["Province_State"]


def toint(n):
    try:
        return int(n)
    except ValueError:
        return 0


# process modifies the data table data in-place, given data file daily
def process(data, daily, date):
    # the daily file (at least recently) has the data broken down very
    # granularly, so the first thing we'll do is sum it up before we add it to
    # the total data
    dailydata = {}
    for row in daily:
        if country(row) == "Mainland China":
            setcountry(row, "China")

        if state(row) and country(row) == "US":
            displayname = f"{state(row)}, {country(row)}"
        else:
            displayname = f"{country(row)}"

        dailydata.setdefault(displayname, {}).setdefault("confirmed", []).append(
            toint(row["Confirmed"])
        )
        dailydata[displayname].setdefault("deaths", []).append(toint(row["Deaths"]))
        dailydata[displayname].setdefault("recovered", []).append(
            toint(row["Recovered"])
        )

        # Because we treat the US specially, we also need to sum up our national rows:
        if country(row) == "US":
            displayname = "United States"
            dailydata.setdefault(displayname, {}).setdefault("confirmed", []).append(
                toint(row["Confirmed"])
            )
            dailydata[displayname].setdefault("deaths", []).append(toint(row["Deaths"]))
            dailydata[displayname].setdefault("recovered", []).append(
                toint(row["Recovered"])
            )

    for name, today in dailydata.items():
        try:
            data.setdefault(name, {}).setdefault("dates", []).append(date)
            data[name].setdefault("confirmed", []).append(sum(today["confirmed"]))
            data[name].setdefault("deaths", []).append(sum(today["deaths"]))
            data[name].setdefault("recovered", []).append(sum(today["recovered"]))
        except:
            print("failed summing row", name, today)
            raise


def main():
    datadir = "jhudata/csse_covid_19_data/csse_covid_19_daily_reports/"
    data = {}
    # it's important to read this in sorted order
    for fname in list(sorted(glob.glob(datadir + "*.csv"))):
        with open(fname, encoding="utf-8-sig") as dailyfile:
            # Grab the date from the filename, like "03-24-2020", and append it
            # to the dates array
            date = fname.split("/")[-1].split(".")[0]

            daily = csv.DictReader(dailyfile)
            process(data, daily, date)

    json.dump(data, open("data.json", "w"), indent=2)
    # json.dump(data, open("data.json", "w"))


if __name__ == "__main__":
    main()
