// TODO: configurable starting point?
// TODO: permalinks that allow sharing of a graph with a particular country set
// or axis type
// TODO: plot new case rate?
// TODO: put actual date in baseline hover
// TODO: move legend when it blocks lines (baseline && log graph)
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

fetchData = async () => {
  rawData = await d3.json("./data.json");
  rawData.dates = rawData.dates.map(parseDate);

  // calculate per capita of confirmed cases
  for (let [name, data] of Object.entries(rawData.data)) {
    if (capita.hasOwnProperty(name)) {
      data.confirmedPerCapita = [];
      data.confirmed.forEach((confirmed) => {
        data.confirmedPerCapita.push((confirmed / capita[name]) * 10000);
      });
    }
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
  document.querySelector("#alignBaseline").checked
    ? graphBaselineAligned()
    : graphConfirmedByDate();
};

parseDate = (dt) => {
  const parts = dt.split("-");
  return (dt = new Date(+parts[2], +parts[0] - 1, +parts[1]));
};

// return the index of the first item that is > min
startidx = (arr, min) => {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] > min) {
      return i;
    }
  }
  return -1;
};

graphBaselineAligned = () => {
  const data = activeRegions.map((r) => rawData.data[r]);
  // hang a baseline array off each data item
  data.forEach(
    (d, i) =>
      (d.baseline = d.confirmedPerCapita.slice(
        startidx(d.confirmedPerCapita, 0.25)
      ))
  );
  const maxX = d3.max(data.map((b) => b.baseline.length));
  const maxY = d3.max(data.map((b) => d3.max(b.baseline)));

  const margin = { top: 10, right: 30, bottom: 50, left: 60 },
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

  svg.on("mousemove", baselineMoved(svg, data, x, y)).on("mouseleave", left);

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
    .data(data.map((d) => d.baseline))
    .join("path")
    .attr("fill", "none")
    .attr("stroke", (d, i) => activeColors[i])
    .attr("stroke-width", 1.5)
    .attr("class", "line")
    .attr("d", (d) => line(d));

  drawLegend(svg, margin, data);

  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", height + 40)
    .attr("text-anchor", "middle")
    .text("Days since case rate exceeded .25 per 10k people");
};

graphConfirmedByDate = () => {
  const data = activeRegions.map((r) => rawData.data[r]);
  const maxdt = d3.max(rawData.dates);
  const maxval = d3.max(data.map((d) => d3.max(d.confirmedPerCapita)));

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
  const dtparts = document.querySelector("#startdate").value.split("-");
  const startdt = new Date(dtparts[0], dtparts[1] - 1, dtparts[2]);
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

  svg.on("mousemove", dateMoved(svg, data, x, y)).on("mouseleave", left);

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
    .attr("d", (d) => line(d3.zip(rawData.dates, d.confirmedPerCapita)));

  drawLegend(svg, margin, data);
};

// return the index of a given date
dateidx = (dt) => {
  for (let idx = 0; idx < rawData.dates.length; idx++) {
    const d = rawData.dates[idx];
    if (d.getMonth() == dt.getMonth() && d.getDate() == dt.getDate()) {
      return idx;
    }
  }
  return -1;
};

// given an array arr, return the index of the minimum element. Returns -1 if
// every element of the array is NaN. I do not understand why d3.minIndex
// (https://github.com/d3/d3-array#minIndex) is not available to me, but it
// seems not to be.
minidx = (arr) => {
  if (!arr.length) {
    return;
  }
  let min = Number.MAX_VALUE;
  let minidx = -1;
  for (let idx = 0; idx < arr.length; idx++) {
    if (!isNaN(arr[idx]) && arr[idx] < min) {
      min = arr[idx];
      minidx = idx;
    }
  }
  return minidx;
};

baselineMoved = (svg, data, xscale, yscale) => {
  return () => {
    d3.event.preventDefault();
    const { x: x0, y: y0 } = svg.node().getBoundingClientRect();
    const dayn = Math.round(xscale.invert(d3.event.clientX - x0));
    const val = yscale.invert(d3.event.clientY - y0);
    const diffs = data.map((d) => Math.abs(val - d.baseline[dayn]));

    // if no lines are close enough, hide the tooltip and exit
    if (diffs.filter((d) => d < 1).length == 0) {
      d3.select("#hover").style("display", "none");
      return;
    }

    // find the closest line and show the tooltip
    const dataidx = minidx(diffs);
    // the index of the data in the non-baseline arrays can be found by
    // starting where the baseline does and adding dayn to it
    const nonBaselineIdx =
      data[dataidx].confirmed.length - data[dataidx].baseline.length + dayn;
    d3
      .select("#hover")
      .style("display", "block")
      .style("left", d3.event.pageX + 10 + "px")
      .style("top", d3.event.pageY + "px").html(`<strong>${
      data[dataidx].displayName
    }</strong><br>
Day number: ${dayn}<br>
Cases: ${data[dataidx].confirmed[nonBaselineIdx]}<br>
Per Capita: ${data[dataidx].confirmedPerCapita[nonBaselineIdx].toFixed(2)}`);
  };
};

dateMoved = (svg, data, xscale, yscale) => {
  return () => {
    d3.event.preventDefault();
    const { x: x0, y: y0 } = svg.node().getBoundingClientRect();
    const dt = xscale.invert(d3.event.clientX - x0 + 20);
    const val = yscale.invert(d3.event.clientY - y0);
    const idx = dateidx(dt);
    const choices = data.map((d) => d.confirmedPerCapita[idx]);
    const diffs = choices.map((d) => Math.abs(val - d));

    // if no lines are close enough, hide the tooltip and exit
    if (diffs.filter((d) => d < 1).length == 0) {
      d3.select("#hover").style("display", "none");
      return;
    }

    // find the closest line and show the tooltip
    const dataidx = minidx(diffs);
    d3
      .select("#hover")
      .style("display", "block")
      .style("left", d3.event.pageX + 10 + "px")
      .style("top", d3.event.pageY + "px").html(`<strong>${
      data[dataidx].displayName
    }</strong><br>
Date: ${dt.toLocaleDateString()}<br>
Cases: ${data[dataidx].confirmed[idx]}<br>
Per Capita: ${data[dataidx].confirmedPerCapita[idx].toFixed(2)}`);
  };
};

left = () => {
  d3.select("#hover").style("display", "none");
};

buildTable = () => {
  // the regions we want to list must be present in the population data and
  // have greater than 1m residents
  const inactiveRegions = d3
    .keys(rawData.data)
    .filter(
      (d) =>
        activeRegions.indexOf(d) == -1 &&
        capita.hasOwnProperty(d) &&
        capita[d] > 1000000
    );

  inactiveRegions.sort((a, b) =>
    d3.max(rawData.data[a].confirmedPerCapita) <
    d3.max(rawData.data[b].confirmedPerCapita)
      ? 1
      : -1
  );

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
  document.querySelector("#logscale").addEventListener("change", graph);
  document.querySelector("#alignBaseline").addEventListener("change", (evt) => {
    if (evt.target.checked) {
      d3.select("label[for=startdate").style("color", "lightgrey");
      document.querySelector("#startdate").disabled = true;
    } else {
      d3.select("label[for=startdate").style("color", "black");
      document.querySelector("#startdate").disabled = false;
    }
    graph();
  });
  document.querySelector("#startdate").addEventListener("change", graph);
};

window.addEventListener("DOMContentLoaded", (evt) => {
  main();
});
