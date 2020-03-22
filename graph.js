// TODO y axis label
// TODO hover
// TODO China and the US are not available in this data as totals. Maybe write
// a post-download-processing script?
// TODO: better starting point? Feb 21 is pretty arbitrarily chosen as the date
// Italy passed 20 cases
//   * probably something like the earliest a selected country passed n cases?
//   * configurable starting point?
// TODO: separate out capita
// TODO: make removing Italy work
// TODO: enforce 10 item max
// TODO: option to align the epidemic starts in some way?
//   * might be a new graph?

// intentionally global. Let's let users play with it in the console if they want
covidData = undefined;

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

const startdt = new Date(2020, 2, 1);

fetchData = async () => {
  // update the global covidData obj
  covidData = await d3.csv("./time_series_19-covid-Confirmed.csv", (row) => {
    // Fix any names that need to be fixed here
    if (row["Country/Region"] == "Korea, South") {
      row["Country/Region"] = "South Korea";
    }

    const name = row["Province/State"] || row["Country/Region"];
    row.name = name;

    if (row["Province/State"]) {
      row.displayName = `${row["Province/State"]}, ${row["Country/Region"]}`;
    } else {
      row.displayName = `${row["Country/Region"]}`;
    }

    // skip countries we don't have population data for
    if (!capita.hasOwnProperty(row.displayName)) {
      return undefined;
    }

    let values = [];

    for (let prop in row) {
      if (Object.prototype.hasOwnProperty.call(row, prop)) {
        // If the field is a date, parse it and add it to the values array.
        // (We'll use this for graphing)
        const parts = prop.split("/");
        if (parts.length == 3) {
          // convert each field to a number
          row[prop] = +row[prop];

          dt = new Date(+("20" + parts[2]), +parts[0] - 1, +parts[1]);
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
    }

    // attach the values array to the row
    row.values = values;

    return row;
  });
  // Sort in order of max per-capita case rate
  covidData.sort((a, b) =>
    d3.max(a.values.map((d) => d.value)) < d3.max(b.values.map((d) => d.value))
      ? 1
      : -1
  );
};

graph = (async) => {
  const data = covidData.filter(
    (d) => activeRegions.indexOf(d.displayName) != -1
  );
  const maxdt = d3.max(data[0].values, (d) => d.dt);
  const maxval = d3.max(data, (row) => d3.max(row.values.map((d) => d.value)));

  console.log(data);

  const margin = { top: 10, right: 30, bottom: 30, left: 60 },
    width = 800 - margin.left - margin.right,
    height = 600 - margin.top - margin.bottom;

  const svg = d3
    .select("svg#graph")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  // Add X axis: the date
  const x = d3.scaleTime().domain([startdt, maxdt]).range([0, width]);
  svg
    .append("g")
    .attr("transform", "translate(0," + (height + 10) + ")")
    .call(d3.axisBottom(x).ticks(15).tickSizeOuter(0).tickSizeInner(0))
    .call((g) => g.select(".domain").remove());

  // Add y axis: the # of confirmed cases
  // https://observablehq.com/@d3/styled-axes
  const y = d3.scaleLinear().domain([0, maxval]).range([height, 0]);
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

  names = data.map((row) => row.name);
  // labels(svg, d3.schemeCategory10, activeRegions, 30, 30);

  const line = d3
    .line()
    .x((d) => x(d.dt))
    .y((d) => y(d.value));

  // for every state/nation, create a line
  // example to follow: https://observablehq.com/@d3/index-chart
  svg
    .append("g")
    .attr("class", "lines")
    .selectAll("path.line")
    .data(data, (d) => d)
    .join("path")
    .attr("fill", "none")
    .attr("stroke", (d, i) => d3.schemeCategory10[i])
    .attr("stroke-width", 1.5)
    .attr("class", "line")
    .attr("d", (d) => line(d.values));

  const legendWidth = 125;
  const legendX = 30;
  const legendY = 30;
  const legendMargin = { top: 10, left: 10 };
  const legend = svg.append("g");

  legend
    .append("rect")
    .attr("x", legendX)
    .attr("y", legendY)
    .attr("width", legendWidth) // todo calculate from label length?
    .attr("height", activeRegions.length * 20 + margin.top)
    .attr("id", "legendBG")
    .attr("fill", "white");

  const keys = legend.selectAll("g").data(data).join("g");

  keys
    .append("circle")
    .attr("cx", legendX + legendMargin.left)
    .attr("cy", (d, i) => legendY + legendMargin.top + 20 * i - 2) // 2 is a fudge factor. Just looks better.
    .attr("r", 4)
    .style("fill", (d, i) => d3.schemeCategory10[i])
    .attr("class", "legendCircle");

  keys
    .append("text")
    .attr("x", legendX + legendMargin.left * 2)
    .attr("y", (d, i) => legendY + legendMargin.top + 20 * i)
    .style("fill", "black")
    .attr("text-anchor", "left")
    .attr("alignment-baseline", "middle")
    .attr("class", "legendLabel")
    .text((d, i) => d.displayName);
};

addHandler = (name) => {
  d3.event.preventDefault();

  activeRegions.push(name);
  buildTable();
  graph();
};

removeHandler = (name) => {
  d3.event.preventDefault();

  activeRegions = activeRegions.filter((x) => x != name);
  buildTable();
  graph();
};

buildTable = (async) => {
  inactiveRegions = covidData
    .map((d) => d.displayName)
    .filter((d) => activeRegions.indexOf(d) == -1);

  d3.select("#allRegions ul")
    .selectAll("li.region")
    .data(inactiveRegions, (d) => d)
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
  await graph();
  await buildTable();
};

window.addEventListener("DOMContentLoaded", (evt) => {
  main();
});
