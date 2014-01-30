<script src="http://d3js.org/d3.v3.min.js"></script>
<script>
// Inspired by http://bl.ocks.org/mbostock/3884955
// and http://jsfiddle.net/YPBjj/
// (via http://stackoverflow.com/questions/16745741/how-to-transition-a-multiseries-line-chart-to-a-new-dataset)
var margin = {top: 20, right: 220, bottom: 20, left: 30},
    width = 960 - margin.left - margin.right,
    height = 500 - margin.top - margin.bottom;

var bisectMonth = d3.bisector(function(d) { return d.month; }).left,
    formatCurrencyValue = d3.format(",.2f"),
    formatCurrency = function(d) { return "$" + formatCurrencyValue(d); },
    formatPercentValue = d3.format(",.0f"),
    formatPercent = function(a,b) {
      return (b > 0)
        ? "(" + formatPercentValue(100 * a / b) + "%)"
        : "";
    };

var x = d3.scale.linear()
    .range([0, width]);

var y = d3.scale.linear()
    .range([height, 0]);

var xAxis = d3.svg.axis()
    .scale(x)
    .ticks(36)
    .tickSize(3)
    .orient("bottom");

var yAxis = d3.svg.axis()
    .scale(y)
    .tickSize(3)
    .orient("left");

var line = d3.svg.line()
    .x(function(d) { return x(d.month); })
    .y(function(d) { return y(d.cost); });

var svg = d3.select("body").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
  .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

// Add the title.
//svg.append("g")
//  .append("text")
//    .attr("x", width/16)
//    .attr("y", 20)
//    .style("font-size", "20px")
//    .style("font-weight", "bold")
//    .text("AWS EC2 Price Comparison");
    
// Add the x-axis.
svg.append("g")
    .attr("class", "x axis")
    .attr("transform", "translate(0," + height + ")")
  .append("text")
    .attr("x", width + 3)
    .text("Month");

// Add the y-axis.
svg.append("g")
    .attr("class", "y axis")
  .append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", 6)
    .attr("dy", ".71em")
    .style("text-anchor", "end")
    .text("Total Cost (USD)");

var SECONDS_IN_YEAR = 31536000;
var SECONDS_IN_MONTH = SECONDS_IN_YEAR / 12;// 2628000
var HOURS_IN_MONTH = 365 * 24 / 12; 		// 730

function createUniqueName(value, durationInYears) {
  if (durationInYears == null)
    durationInYears = value.duration / SECONDS_IN_YEAR;
  return ((durationInYears > 0) ? durationInYears + "-yr" : "")
    + " " + value.offeringType
    + " " + value.productDescription
    + " " + value.instanceType;
}

function calculateTotalCost(offering, monthlyPrice) {
  var totalMonthlyCost = [];
  var durationInMonths = offering.value.duration / SECONDS_IN_MONTH;

  totalMonthlyCost[0] = {
    month: 0, 
    cost: +offering.value.fixedPrice
  };
  for (var month = 1; month <= 36; month++) {
    var terms = offering.value.fixedPrice > 0
      ? Math.floor(((month - 1) / durationInMonths) + 1)	// 1 year term 1 = months 0-12, 1 year term 2 = months 13-24
      : 0;	// On-Demand
    totalMonthlyCost[month] = {
      month: month,
      cost: (terms * offering.value.fixedPrice) + (month * monthlyPrice)
    }
  }

  return totalMonthlyCost;
}

update();

function update() {
// Construct REST URL
var resturl = "http://p1software-eb1.elasticbeanstalk.com/awsec2offering/api"
  + "/" + d3.select("#availabilityZone").node().value	// us-east-1a
  + "/" + d3.select("#productDescription").node().value	// linux
  + "/" + d3.select("#offeringType").node().value		// heavy
  + "/" + d3.select("#instanceType1").node().value		// t1.micro
  + "," + d3.select("#instanceType2").node().value;		// m1.small

// resturl = "test.json"
// resturl = "http://localhost:8080/awsec2offering/awsec2offering/api/us-east-1a/linux/heavy/t1.micro,m1.small."
d3.json(resturl, function(error, json) {
  data = json.ec2offerings;

  // Assign colors to each unique name.	
  var color = d3.scale.category10();
  color.domain(data.map(function(p) { return createUniqueName(p); }));

  // Coerce the data to numbers.
  data.forEach(function(d) {
    d.month = +d.month;
  });
  
  // Extract the array in the json object into rates.
  var rates = d3.entries(data).map(function(offering) {
    var durationInYears = offering.value.duration / SECONDS_IN_YEAR;
    var monthlyPrice = offering.value.hourlyPrice * HOURS_IN_MONTH;
    var z = {
      name: createUniqueName(offering.value, durationInYears),
      durationInYears: durationInYears,
      fixedPrice: offering.value.fixedPrice,
      monthlyPrice: monthlyPrice,
      values: calculateTotalCost(offering, monthlyPrice)
    }
    return z;
  });

  x.domain([
    d3.min(rates, function(c) { return d3.min(c.values, function(v) { return v.month; }); }),
    d3.max(rates, function(c) { return d3.max(c.values, function(v) { return v.month; }); })
  ]);
  y.domain([
    d3.min(rates, function(c) { return d3.min(c.values, function(v) { return v.cost; }); }),
    d3.max(rates, function(c) { return d3.max(c.values, function(v) { return v.cost; }); })
  ]);

  // Update the x-axis.
  d3.transition(svg).select('.x.axis')
      .call(xAxis);

  // Update y-axis.
  d3.transition(svg).select('.y.axis')
      .call(yAxis);

  // DATA JOIN
  var rate = svg.selectAll(".rate")
      .data(rates);

  // ENTER
  var rateEnter = rate.enter().append("g")
      .attr("class", "rate");

  // Add the lines.
  rateEnter.append("path")
      .attr("class", "line")
      .attr("d", function(d) { return line(d.values); })
      .style("stroke", function(d) { return color(d.name); });

  // Add the line labels in the right margin.
  rateEnter.append("text")
      .datum(function(d) { return {name: d.name, value: d.values[d.values.length - 1]}; })
      .attr("transform", function(d) { return "translate(" + x(d.value.month) + "," + y(d.value.cost) + ")"; })
      .attr("x", 3)
      .attr("dy", ".35em")
      .text(function(d) { return d.name; });

  
  // http://bl.ocks.org/mbostock/3902569
  // http://bl.ocks.org/gniemetz/4618602
  // http://bl.ocks.org/benjchristensen/2657838
  // http://stackoverflow.com/questions/19003832/d3-x-value-mouseover-function-returns-nan
  // http://jsfiddle.net/U4CGz/7/
  // http://code.shutterstock.com/rickshaw/examples/lines.html
  var focus = svg.append("g")
      .attr("class", "focus")
      .style("display", "none");

  var circles = focus.selectAll('circle')
      .data(rates)
    .enter()
      .append('circle')
      .attr('class', 'circle')
      .attr('r', 4)
      .attr('fill', 'none')
      .attr('stroke', function (d) { return color(d.name); });

  rate.append("rect")
      .attr("class", "overlay")
      .attr("width", width)
      .attr("height", height)
      .on("mouseover", function() { focus.style("display", null); })
      .on("mouseout", function() { focus.style("display", "none"); })
      .on("mousemove", mousemove);

  function mousemove() {
    var x0 = x.invert(d3.mouse(this)[0]),	// 0.00 .. 36.00
        month = Math.round(x0);				// 0 .. 36
    circles.attr('transform', function (d) {
      return 'translate(' + x(month) + ',' + y(d.values[month].cost) + ')';
    });

	// Load month's costs into sortedRows, then sort from high to low
	var sortedRows = [];
	for (i = 0; i < rates.length; i++) {
	  sortedRows.push({
	    name: rates[i].name,
        durationInYears: rates[i].durationInYears,
        fixedPrice: rates[i].fixedPrice,
        monthlyPrice: rates[i].monthlyPrice,
	    cost: rates[i].values[month].cost
	  });
	}
	sortedRows.sort(function(a,b) { return b.cost - a.cost;});

    // https://groups.google.com/forum/#!topic/d3-js/LPVuNpPm0Wc
    d3.select("#th-cost").text(month + " Month Total");
    for (i = 0; i < sortedRows.length; i++) {
      // Fixed columns
      d3.select("#td-fixed" + i).text(formatCurrency(sortedRows[i].fixedPrice));
      d3.select("#td-monthly" + i).text(formatCurrency(sortedRows[i].monthlyPrice));

      // Calculate total costs
      var iCost = sortedRows[i].cost;
      var iCostId = "#td-cost" + i;
      d3.select("#td-name" + i).text(sortedRows[i].name);
      d3.select(iCostId).text(formatCurrency(iCost))
        .style('color', color(sortedRows[i].name));

      // Calculate the savings triangle
  	  for (j = i + 1; j < sortedRows.length; j++) {
        var jCost = sortedRows[j].cost;
        var jCostId = "#td-cost" + i + "-" + j;
        var savings = iCost - jCost;
        d3.select(jCostId)
          .text("+" + formatCurrency(savings) + formatPercent(savings, jCost))
          .style('color', color(sortedRows[j].name));      
  	  }
    }

    sortedRows = null;
  } // mousemove

  
  var rateUpdate = d3.transition(rate);

  rateUpdate.select("path")
      .transition().duration(600)
      .attr("d", function(d) {
    	return line(d.values); 
      });

  rateUpdate.select("text")
      .datum(function(d) { return {name: d.name, value: d.values[d.values.length - 1]}; })
      .transition().duration(600)
      .attr("transform", function(d,i) { return "translate(" + x(d.value.month) + "," + y(d.value.cost) + ")"; })
      .text(function(d) { return d.name; });
  
  // EXIT
  rate.exit().remove();
});
} // update
</script>
