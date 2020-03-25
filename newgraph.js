// TODO: sort countries/states by max per-capita (rn unsorted)
// TODO: don't put same dates in for each data point
// TODO: configurable starting point?
// TODO: permalinks that allow sharing of a graph with a particular country set
// or axis type
// TODO: plot new case rate?
//
// intentionally global. Let's let users play with it in the console if they want
rawData = undefined;

// activeRegions must match the name of a rawData key
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

// start at March 1
const startdt = new Date(2020, 2, 1);

fetchData = async () => {
  rawData = await d3.json("./data.json");

  // calculate per capita of confirmed cases
  for (let [name, data] of Object.entries(rawData)) {
    if (capita.hasOwnProperty(name)) {
      data.confirmedPerCapita = [];
      data.confirmed.forEach((confirmed) => {
        data.confirmedPerCapita.push((confirmed / capita[name]) * 10000);
      });
    }

    data.dates = data.dates.map(parseDate);
  }
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
    .text((d) => d.displayName);

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

graph = () => {
  graphConfirmedByDate();
};

parseDate = (dt) => {
  const parts = dt.split("-");
  return (dt = new Date(+parts[2], +parts[0] - 1, +parts[1]));
};

graphConfirmedByDate = () => {
  const data = activeRegions.map((r) => rawData[r]);
  const maxdt = d3.max(data.map((d) => d3.max(d.dates)));
  const maxval = d3.max(data.map((d) => d3.max(d.confirmed)));

  const margin = { top: 10, right: 30, bottom: 30, left: 60 },
    width = 800 - margin.left - margin.right,
    height = 600 - margin.top - margin.bottom;

  // clear the container
  d3.select("#graphContainer svg").remove();

  const svg = d3
    .select("#graphContainer")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom);

  svg
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
    .x((d) => x(d[0]))
    .y((d) => y(d[1]));

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
    .attr("d", (d) => line(d3.zip(d.dates, d.confirmed)));

  drawLegend(svg, margin, data);
};

buildTable = () => {
  const inactiveRegions = d3
    .keys(rawData)
    .filter((d) => activeRegions.indexOf(d) == -1);

  const inactiveCountries = inactiveRegions
    .filter((d) => d.indexOf(", US") == -1)
    .slice(0, 55);
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

main = async () => {
  await fetchData();
  buildTable();
  graph();
};

window.addEventListener("DOMContentLoaded", (evt) => {
  main();
});
