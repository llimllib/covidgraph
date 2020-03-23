// TODO hover
// TODO: better starting point? Mar 1 is pretty arbitrarily chosen as the date
// Italy passed 20 cases
//   * probably something like the earliest a selected country passed n cases?
//   * configurable starting point?
// TODO: permalinks that allow sharing of a graph with a particular country set
// or axis type

// intentionally global. Let's let users play with it in the console if they want
covidData = undefined;
rawData = undefined;
baselineData = undefined;

// activeRegions must match the displayName of a covidData row
let activeRegions = [
  "Italy",
  "New York, US",
  "Washington, US",
  "South Korea",
  "California, US",
  "New Jersey, US",
  "Maine, US",
];

// We want to keep colors consistent when changing the activeRegions map, so
// maintain a parallel list of colors. When we remove elt `i` from
// activeRegions, we must move elt `i` of activeColors to inactiveColors. When
// we add to activeRegions, we must move a color from inactiveColors to
// activeColors
let activeColors = d3.schemeCategory10.slice(0, activeRegions.length);
let inactiveColors = d3.schemeCategory10.slice(activeRegions.length);

const startdt = new Date(2020, 2, 1);

addChina = (data) => {
  newRow = {
    name: "China",
    displayName: "China",
    "Country/Region": "China",
  };

  data.forEach((row) => {
    if (row["Country/Region"] == "China") {
      for (let prop in row) {
        const parts = prop.split("/");
        // if it's a date
        if (parts.length == 3) {
          if (!newRow.hasOwnProperty(prop)) {
            newRow[prop] = row[prop];
          } else {
            newRow[prop] += row[prop];
          }
        }
      }
    }
  });

  data.push(newRow);
};

addUSA = (data) => {
  newRow = {
    displayName: "United States",
    "Country/Region": "United States",
  };

  data.forEach((row) => {
    // there are rows for particular US counties in the data set; eliminate
    // those by checking for a comma in the province/state field
    if (
      row["Country/Region"] == "US" &&
      row["Province/State"].indexOf(",") == -1
    ) {
      for (let prop in row) {
        const parts = prop.split("/");
        // if it's a date
        if (parts.length == 3) {
          if (!newRow.hasOwnProperty(prop)) {
            newRow[prop] = row[prop];
          } else {
            newRow[prop] += row[prop];
          }
        }
      }
    }
  });

  data.push(newRow);
};

calcPerCapitaValues = (data) => {
  data.forEach((row) => {
    let values = [];

    for (let prop in row) {
      // If the field is a date, parse it and add it to the values array.
      // (We'll use this for graphing)
      const parts = prop.split("/");
      if (parts.length == 3) {
        const dt = new Date(+("20" + parts[2]), +parts[0] - 1, +parts[1]);

        if (dt < startdt) {
          continue;
        }

        // We're going to graph the reported incidences per 10k people
        const percapita = (row[prop] / capita[row.displayName]) * 10000;
        values.push({
          dt: dt,
          value: percapita,
        });
      }
    }

    row.values = values;
  });
};

fetchData = async () => {
  // intentionally update the rawData global
  rawData = await d3.csv("./time_series_19-covid-Confirmed.csv", (row) => {
    ckey = "Country/Region";
    pkey = "Province/State";

    // Fix any names that need to be fixed here
    if (row[ckey] == "Korea, South") {
      row[ckey] = "South Korea";
    }

    // Many countries are listed like France, France or United Kingdom, United
    // Kingdom. Remove their pkey so we read them as a country
    if (row[ckey] == row[pkey]) {
      row[pkey] = "";
    }

    if (row[pkey]) {
      row.displayName = `${row[pkey]}, ${row[ckey]}`;
    } else {
      row.displayName = `${row[ckey]}`;
    }

    for (let prop in row) {
      if (Object.prototype.hasOwnProperty.call(row, prop)) {
        // If the field is a date, convert its value to a number
        const parts = prop.split("/");
        if (parts.length == 3) {
          row[prop] = +row[prop];
        }
      }
    }

    return row;
  });

  addChina(rawData);
  addUSA(rawData);

  // skip countries we don't have population data for. Intentionally populate
  // the global covidData value
  covidData = rawData.filter(
    (d) =>
      capita.hasOwnProperty(d.displayName) && capita[d.displayName] > 100000
  );

  calcPerCapitaValues(covidData);

  // Sort in order of max per-capita case rate
  covidData.sort((a, b) =>
    d3.max(a.values.map((d) => d.value)) < d3.max(b.values.map((d) => d.value))
      ? 1
      : -1
  );
};

calcBaselineAlignedData = () => {
  // intentionally update the global baselineData
  baselineData = rawData.map((row) => {
    newRow = { displayName: row.displayName };
    passedTen = false;
    values = [];
    // For every column in the row, if it's a date column, check if it's >10.
    // As soon as we have one column that is, start saving every data point.
    // Assumes that the date columns remain sorted in ascending order.
    for (let prop in row) {
      const parts = prop.split("/");
      // if it's a date
      if (parts.length == 3) {
        const percapita = (row[prop] / capita[row.displayName]) * 10000;
        if (!passedTen && percapita > 0.1) {
          passedTen = true;
        }
        if (passedTen) {
          values.push(percapita);
        }
      }
    }
    newRow.values = values;
    return newRow;
  });
};

drawLegend = (svg, margin, data) => {
  const legendWidth = 140;
  const x = 40;
  const y = 10;
  const legendMargin = { top: 100, left: 20 };
  const legend = svg.append("g");

  legend
    .append("rect")
    .attr("x", legendMargin.left + x - 8)
    .attr("y", legendMargin.top)
    .attr("width", legendWidth) // todo calculate from label length?
    .attr("height", activeRegions.length * 20 + margin.top)
    .attr("id", "legendBG")
    .attr("fill", "white");

  const keys = legend.selectAll("g").data(data).join("g");

  keys
    .append("circle")
    .attr("cx", x + legendMargin.left)
    .attr("cy", (d, i) => y + legendMargin.top + 20 * i - 2) // 2 is a fudge factor. Just looks better.
    .attr("r", 4)
    .style("fill", (d, i) => activeColors[i])
    .attr("class", "legendCircle");

  keys
    .append("text")
    .attr("x", x + legendMargin.left * 2)
    .attr("y", (d, i) => y + legendMargin.top + 20 * i)
    .style("fill", "black")
    .attr("text-anchor", "left")
    .attr("alignment-baseline", "middle")
    .attr("class", "legendLabel")
    .text((d, i) => d.displayName);

  svg
    .append("rect")
    .attr("x", 27)
    .attr("y", 30)
    .attr("width", 270)
    .attr("height", 20)
    .attr("fill", "white");
  svg
    .append("text")
    .attr("x", 30)
    .attr("y", 50)
    .text("Confirmed covid cases per 10,000 people");
};

// Create a graph where each state/country/we is graphed where day 0 is the day they had 10 cases
graphBaselineAligned = () => {
  if (!baselineData) {
    calcBaselineAlignedData();
  }
  const data = activeRegions.map((r) =>
    baselineData.find((d) => d.displayName == r)
  );
  const maxX = d3.max(data.map((d) => d.values.length));
  const maxY = d3.max(data.map((d) => d3.max(d.values)));

  console.log(data);
  const margin = { top: 10, right: 30, bottom: 50, left: 60 },
    width = 800 - margin.left - margin.right,
    height = 600 - margin.top - margin.bottom;

  // clear the container
  d3.select("#graphContainer svg").remove();

  const svg = d3
    .select("#graphContainer")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  const x = d3.scaleLinear().domain([0, maxX]).range([0, width]);
  svg
    .append("g")
    .attr("transform", "translate(0," + (height + 10) + ")")
    .call(d3.axisBottom(x).ticks(8).tickSizeOuter(0).tickSizeInner(0))
    .call((g) => g.select(".domain").remove());

  // Add y axis: the # of confirmed cases
  // https://observablehq.com/@d3/styled-axes
  const y = document.querySelector("#logscale").checked
    ? d3.scaleLog().domain([0.25, maxY]).range([height, 0]).base(2).clamp(true)
    : d3.scaleLinear().domain([0, maxY]).range([height, 0]);

  svg
    .append("g")
    .attr("transform", "translate(0, 0)")
    .call(d3.axisRight(y).tickSize(width).ticks(10))
    // remove the y axis bar
    .call((g) => g.select(".domain").remove())
    // make the tick lines translucent
    .call((g) =>
      g.selectAll(".tick:not(:first-of-type) line").attr("stroke-opacity", 0.2)
    )
    // move the tick labels to the left
    .call((g) => g.selectAll(".tick text").attr("x", 4).attr("dy", -4));

  const line = d3
    .line()
    .x((d, i) => x(i))
    .y((d) => y(d));

  // for every state/nation, create a line
  // example to follow: https://observablehq.com/@d3/index-chart
  svg
    .append("g")
    .attr("class", "lines")
    .selectAll("path")
    .data(data)
    .join("path")
    .attr("fill", "none")
    .attr("stroke", (d, i) => activeColors[i])
    .attr("stroke-width", 1.5)
    .attr("class", "line")
    .attr("d", (d) => line(d.values));

  drawLegend(svg, margin, data);

  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", height + 40)
    .attr("text-anchor", "middle")
    .text("Days since case rate exceeded .1 per 10k people");
};

graph = () => {
  document.querySelector("#alignBaseline").checked
    ? graphBaselineAligned()
    : graphByDate();
};

graphByDate = () => {
  // It's important to keep the order of the `activeRegions` map the same as
  // the order of `data` so that we keep the color choices stable
  const data = activeRegions.map((r) =>
    covidData.find((d) => d.displayName == r)
  );
  const maxdt = d3.max(data[0].values, (d) => d.dt);
  const maxval = d3.max(data, (row) => d3.max(row.values.map((d) => d.value)));

  console.log(data);

  const margin = { top: 10, right: 30, bottom: 30, left: 60 },
    width = 800 - margin.left - margin.right,
    height = 600 - margin.top - margin.bottom;

  // clear the container
  d3.select("#graphContainer svg").remove();

  const svg = d3
    .select("#graphContainer")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  // Add X axis: the date
  const x = d3.scaleTime().domain([startdt, maxdt]).range([0, width]);
  svg
    .append("g")
    .attr("transform", "translate(0," + (height + 10) + ")")
    .call(d3.axisBottom(x).ticks(8).tickSizeOuter(0).tickSizeInner(0))
    .call((g) => g.select(".domain").remove());

  // Add y axis: the # of confirmed cases
  // https://observablehq.com/@d3/styled-axes
  const y = document.querySelector("#logscale").checked
    ? d3
        .scaleLog()
        .domain([0.25, maxval])
        .range([height, 0])
        .base(2)
        .clamp(true)
    : d3.scaleLinear().domain([0, maxval]).range([height, 0]);

  svg
    .append("g")
    .attr("transform", "translate(0, 0)")
    .call(d3.axisRight(y).tickSize(width).ticks(10))
    // remove the y axis bar
    .call((g) => g.select(".domain").remove())
    // make the tick lines translucent
    .call((g) =>
      g.selectAll(".tick:not(:first-of-type) line").attr("stroke-opacity", 0.2)
    )
    // move the tick labels to the left
    .call((g) => g.selectAll(".tick text").attr("x", 4).attr("dy", -4));

  const line = d3
    .line()
    .x((d) => x(d.dt))
    .y((d) => y(d.value));

  // for every state/nation, create a line
  // example to follow: https://observablehq.com/@d3/index-chart
  svg
    .append("g")
    .attr("class", "lines")
    .selectAll("path")
    .data(data, (d) => d.values)
    .join("path")
    .attr("fill", "none")
    .attr("stroke", (d, i) => activeColors[i])
    .attr("stroke-width", 1.5)
    .attr("class", "line")
    .attr("d", (d) => line(d.values));

  drawLegend(svg, margin, data);
};

addHandler = (name) => {
  d3.event.preventDefault();

  if (activeRegions.length < 10) {
    activeRegions.push(name);
    activeColors.push(inactiveColors.shift());
  }
  buildTable();
  graph();
};

removeHandler = (name) => {
  d3.event.preventDefault();

  // remove the region from activeRegions and remove its color from
  // activeColors, and return it to the color pool
  const idx = activeRegions.indexOf(name);
  activeRegions.splice(idx, 1);
  inactiveColors.push(activeColors[idx]);
  activeColors.splice(idx, 1);
  buildTable();
  graph();
};

buildTable = () => {
  const inactiveRegions = covidData
    .map((d) => d.displayName)
    .filter((d) => activeRegions.indexOf(d) == -1);

  const inactiveCountries = inactiveRegions
    .filter((d) => d.indexOf(", US") == -1)
    .slice(0, 40);
  const inactiveStates = inactiveRegions.filter((d) => d.indexOf(", US") != -1);

  d3.select("#countries ul")
    .selectAll("li.region")
    .data(inactiveCountries, (d) => d)
    .join("li")
    .attr("class", "region")
    .on("click", addHandler)
    .html((d) => `<a href="#" class="add" data-name="${d}">${d} >></a>`);

  d3.select("#states ul")
    .selectAll("li.region")
    .data(inactiveStates, (d) => d)
    .join("li")
    .attr("class", "region")
    .on("click", addHandler)
    .html((d) => `<a href="#" class="add" data-name="${d}">${d} >></a>`);

  d3.select("#selectedRegions ul")
    .selectAll("li.activeRegion")
    .data(activeRegions, (d) => d)
    .join("li")
    .attr("class", "activeRegion")
    .on("click", removeHandler)
    .html((d) => `<a href="#" class="rem" data-name="${d}">${d} <<</a>`);
};

main = async () => {
  await fetchData();
  graph();
  buildTable();
  document.querySelector("#logscale").addEventListener("change", graph);
  document.querySelector("#alignBaseline").addEventListener("change", graph);
};

window.addEventListener("DOMContentLoaded", (evt) => {
  main();
});
