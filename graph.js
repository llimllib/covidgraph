label = (svg, color, text, y) => {
  const x = 50;
  svg
    .append("circle")
    .attr("cx", x)
    .attr("cy", y + 3)
    .attr("r", 4)
    .style("fill", color);
  let label = svg
    .append("text")
    .attr("x", x + 8)
    .attr("y", y + 5)
    .attr("r", 4)
    .text(text)
    .style("fill", "black")
    .attr("text-anchor", "left")
    .style("alignment-baseline", "middle");
};

capita = {
  Italy: 60317546,
  Alabama: 4830620,
  Alaska: 733375,
  Arizona: 6641928,
  Arkansas: 2958208,
  California: 38421464,
  Colorado: 5278906,
  Connecticut: 3593222,
  Delaware: 926454,
  "District of Columbia": 647484,
  Florida: 19645772,
  Georgia: 10006693,
  Hawaii: 1406299,
  Idaho: 1616547,
  Illinois: 12873761,
  Indiana: 6568645,
  Iowa: 3093526,
  Kansas: 2892987,
  Kentucky: 4397353,
  Louisiana: 4625253,
  Maine: 1329100,
  Maryland: 5930538,
  Massachusetts: 6705586,
  Michigan: 9900571,
  Minnesota: 5419171,
  Mississippi: 2988081,
  Missouri: 6045448,
  Montana: 1014699,
  Nebraska: 1869365,
  Nevada: 2798636,
  "New Hampshire": 1324201,
  "New Jersey": 8904413,
  "New Mexico": 2084117,
  "New York": 19673174,
  "North Carolina": 9845333,
  "North Dakota": 721640,
  Ohio: 11575977,
  Oklahoma: 3849733,
  Oregon: 3939233,
  Pennsylvania: 12779559,
  "Rhode Island": 1053661,
  "South Carolina": 4777576,
  "South Dakota": 843190,
  Tennessee: 6499615,
  Texas: 26538614,
  Utah: 2903379,
  Vermont: 626604,
  Virginia: 8256630,
  Washington: 6985464,
  "West Virginia": 1851420,
  Wisconsin: 5742117,
  Wyoming: 579679,
  "Puerto Rico": 3583073,
  "South Korea": 51709098
};

graph = async () => {
  let mindt = new Date(9999999999999);
  let maxdt = new Date(0);
  let maxval = 0;
  const startdt = new Date(2020, 1, 21);
  const data = await d3.csv("./time_series_19-covid-Confirmed.csv", row => {
    // For now, let's just filter to Italy, California, New York, CT and Maine
    if (
      ["Italy", "Korea, South"].indexOf(row["Country/Region"]) == -1 &&
      ["California", "Maine", "New York", "Connecticut", "Florida"].indexOf(
        row["Province/State"]
      ) == -1
    ) {
      return;
    }

    if (row["Country/Region"] == "Korea, South") {
      row["Country/Region"] = "South Korea";
    }

    let values = [];

    for (var prop in row) {
      if (Object.prototype.hasOwnProperty.call(row, prop)) {
        // Province/State and Country/Region fields are string. Everything
        // else is numeric.
        if (prop.startsWith("Provi") || prop.startsWith("Country")) {
          continue;
        }

        // convert each field to a number
        row[prop] = +row[prop];

        // If the field is a date, parse it and find out if it's the min or max
        // date and if it's the largest value in the dataset. Finally, add it
        // to the values array. (We'll use this for graphing)
        const parts = prop.split("/");
        if (parts.length == 3) {
          dt = new Date(+("20" + parts[2]), +parts[0] - 1, +parts[1]);

          // The virus didn't start to pick up in Italy until Feb 21, so
          // eliminate dates before that
          if (dt < startdt) {
            continue;
          }

          if (dt < mindt) {
            mindt = dt;
          } else if (dt > maxdt) {
            maxdt = dt;
          }

          const name = row["Province/State"] || row["Country/Region"];
          // We're going to graph the reported incidences per 10k people
          const percapita = (row[prop] / capita[name]) * 10000;
          if (percapita > maxval) {
            maxval = percapita;
          }
          values.push({
            dt: dt,
            value: percapita
          });
        }
      }
    }
    row.values = values;
    return row;
  });

  console.log(data);

  const margin = { top: 10, right: 30, bottom: 30, left: 60 },
    width = 800 - margin.left - margin.right,
    height = 600 - margin.top - margin.bottom;

  // append the svg object to the body of the page
  const svg = d3
    .select("#graph")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  // Add X axis: the date
  const x = d3
    .scaleTime()
    .domain([mindt, maxdt])
    .range([0, width]);
  svg
    .append("g")
    .attr("transform", "translate(0," + (height + 10) + ")")
    .call(
      d3
        .axisBottom(x)
        .ticks(15)
        .tickSizeOuter(0)
        .tickSizeInner(0)
    )
    .call(g => g.select(".domain").remove());

  // Add y axis: the # of confirmed cases
  const y = d3
    .scaleLinear()
    .domain([0, maxval])
    .range([height, 0]);
  svg
    .append("g")
    .attr("transform", "translate(0, 0)")
    .call(
      d3
        .axisRight(y)
        .tickSize(width)
        .ticks(10)
    )
    // remove the y axis bar
    .call(g => g.select(".domain").remove())
    // make the tick lines translucent
    .call(g =>
      g.selectAll(".tick:not(:first-of-type) line").attr("stroke-opacity", 0.2)
    )
    // move the tick labels to the left
    .call(g =>
      g
        .selectAll(".tick text")
        .attr("x", 4)
        .attr("dy", -4)
    );

  // yAxis = svg => svg
  //     .attr("transform", `translate(${margin.left},0)`)
  //     .call(d3.axisRight(y)
  //         .tickSize(width - margin.left - margin.right)
  //         .tickFormat(formatTick))
  //     .call(g => g.select(".domain")
  //         .remove())
  //     .call(g => g.selectAll(".tick:not(:first-of-type) line")
  //         .attr("stroke-opacity", 0.5)
  //         .attr("stroke-dasharray", "2,2"))
  //     .call(g => g.selectAll(".tick text")
  //         .attr("x", 4)
  //         .attr("dy", -4))

  // for every state/nation, create a line
  data.forEach((row, idx) => {
    // 10 categorical colors. 10 lines seems like a reasonable max we can
    // display on the graph?
    const color = d3.schemeCategory10[idx];
    svg
      .append("path")
      .datum(row.values)
      .attr("fill", "none")
      .attr("stroke", color)
      .attr("stroke-width", 1.5)
      .attr(
        "d",
        d3
          .line()
          .x(function(d) {
            return x(d.dt);
          })
          .y(function(d) {
            return y(d.value);
          })
      );
    label(
      svg,
      color,
      row["Province/State"] || row["Country/Region"],
      idx * 20 + 50
    );
  });
};

window.addEventListener("DOMContentLoaded", evt => {
  graph();
});
