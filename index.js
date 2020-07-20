/**
 * Class for the UI of a plot.
 */
class DataSelector {
    /**
     * Create the UI and plot.
     *
     * @param compounds - list of compound names that should be in drop-down menu
     * @param dataXdefault
     * @param xOptions
     * @param dataYDefault - object key to use for plotting, eg d['value'] if dataXKey = 'value'
     * @param yOptions - array of options for y-axis data
     * @param CTimeFormat
     * @param UTCoffset
     * @param width - width dimension in pixels for the plot
     * @param height - height dimension in pixels for the plot
     * @param xZoomLimit - smallest time period to allow for an x axis zoom in milliseconds
     * @param yAxisRound - unit of y-axis that display values should be rounded to
     * @param CSS - object of necessary CSS classes for data format, selection, etc
     * @param margins
     * @param DOMelements
     * @param DOMButtons - necessary buttons in the DOM
     * @param toolTipIncludes - 'salt' for the tooltip; The field of the JSON data that should be added to date in all
     *     displays, eg '2019-03-19 02:20' + d['sample_ID'] could be used to enforce uniqueness with shared dates
     */
    constructor(compounds, dataXdefault, xOptions, dataYDefault, yOptions, CTimeFormat, UTCoffset,
                width, height, xZoomLimit, yAxisRound,
                CSS, margins, DOMelements, DOMButtons,
                toolTipIncludes) {
        /** Array of compound names that are part of the UI and have corresponding data*/
        this.compounds = compounds;

        this.dataXDefault = dataXDefault;

        this.xOptions = xOptions;

        this.dataYDefault = dataYDefault;

        this.yOptions = yOptions;

        this.zoomHistory = new Map();

        /** timeformat to be assigned for the x axis*/
        this.timeFormat = d3.timeFormat(CTimeFormat);

        this.buttons = DOMButtons;

        this.CSS = CSS;

        /** Map of selected data points, sorted by compound*/
        this.selectionsByCompound = new Map();

        /** Object containing date: <Set> of compound pairs*/
        this.selectionsByDate = new Map();

        /** Compound last rendered on the plot*/
        this.previousCompound = undefined;

        /** Dates selected for the current compound*/
        this.selectedDates = undefined;

        /** Step to round to for values on the y axis.*/
        this.yRound = yAxisRound;

        /** Millisecond limit for zooming in; ie force a small zoom window to be at least zoomLimitX in milliseconds*/
        this.xZoomLimit = xZoomLimit;

        /** Offset from UTC in hours; used to correct data if incoming epoch times are not in UTC*/
        this.UTCoffset = UTCoffset;

        /** Field of the JSON data that should be added to date in all displays for uniqueness*/
        this.toolTipText = toolTipText;

        /** List of DOM elements necessary for plot to be controlled*/
        this.elements = DOMelements;

        /** Margins in pixels for top, bottom, right, left*/
        this.margins = margins;

        /** SVG added to the canvas, the base for all plot groups and objects*/
        this.svg = d3.select(this.CSS.canvasID).append('svg')
            .attr('width', width)
            .attr('height', height)
            .call(this.makeResponsive());

        /** Text box within the DOM*/
        this.textBox = d3.select(this.CSS.selectedTextBoxID);

        /** Calculated width for the graph object with margins*/
        this.graphWidth = width - (this.margins.left + this.margins.right);

        /** Calculated height for the graph object with margins*/
        this.graphHeight = height - (this.margins.top + this.margins.bottom);

        /** The graph itself*/
        this.graph = this.svg.append('g')
            .attr('width', this.graphWidth)
            .attr('height', this.graphHeight);

        /** Invisible rectangle used for selecting; style is toggled when active*/
        this.selectangle = this.svg.append('rect').style('opacity', 0).style('fill', null);

        /** Group added to the body for the tooltip; adding to body keeps it above all else*/
        this.toolTipGroup = d3.select('body').append('g')
            .style('opacity', 0)
            .attr('pointer-events', "none");

        /** Div added to the toolTipGroup that will contain text; makes for easy sizing*/
        this.toolTip = this.toolTipGroup.append('div').attr('class', this.CSS.toolTipClass);

        /** Filter for drag events that ignores buttons, ctrl + drag, and any clicks on data-point objects */
        let filter = () => {  // set drag on SVG for rectangle-selecting
            return !d3.event.ctrlKey
                && !d3.event.button
                && !d3.select(d3.event.target).classed(this.CSS.dataPointClass);
        };

        // assign drag functions to SVG
        this.svg.call(d3.drag()
            .filter(filter)
            .on('start', this.dragStart())
            .on('drag', this.dragUpdate())
            .on('end', this.dragEnd()));

        // graph-wide event listener -- filters for clicks on data-points only
        this.graph.on('click', () => {
            if (d3.select(d3.event.target).classed(this.CSS.dataPointClass)) { // only handle clicked data-points
                this.updateClicked(d3.event.target, true);
                // call with a flag; if already found in set, remove it
            }
        });

        /** Group for xAxis elements*/
        this.xAxisGroup = this.graph.append('g').attr('transform',
            `translate(0, ${this.graphHeight-this.margins.top})`);

        /** Group for yAxis elements*/
        this.yAxisGroup = this.graph.append('g').attr('transform',
            `translate(${this.margins.left}, 0)`);

        this.initListeners();
        this.initVars();
    }

    /**
     * Update the axes with optional limits on the x and y axes.
     *
     * Calling without limits will pass null values to render(), which calls createScales(), which will use max/min
     * values determined with D3 if it recieves null values.
     *
     * @param xMin - new min limit on the x axix
     * @param xMax - new max limit on the x axix
     * @param yMin - new min limit on the y axis
     * @param yMax - new max limit on the y axis
     */
    updateAxes(xMin = null, xMax = null, yMin = null, yMax = null) {
        console.log("Update axes called", xMin, xMax);
        this.commitSelections(this.elements.selector.value);
        // render with no axis arguments to get defaults
        this.render(this.elements.selector.value, xMin, xMax, yMin, yMax);
    };

    /**
     * Closure on starting function for dragging that makes this (the plot) 'that'
     * @returns {Function} - the function that should be called when a d3.drag event occurs
     */
    dragStart = () => {
        const that = this;

        return function() {
            // ensure rectangle is above all other elements, set visible and define as 1x1px to start
            that.selectangle.raise()
                .style('opacity', .85)
                .attr('stroke-width', 2)
                .attr('rx', 2)
                .attr('ry', 2)
                .attr('x', d3.mouse(this)[0])
                .attr('y', d3.mouse(this)[1])
                .attr('height', 1)
                .attr('width', 1)
                .attr('stroke', 'black')
                .attr('fill', 'none');
        };
    };

    /**
     * Closure on drag update function for dragging that makes this (the plot) 'that'
     * @returns {Function} - the function that should be called when a d3.drag update events occur
     */
    dragUpdate = () => {
        const that = this;

        return function() {
            let width, height;

            width = d3.mouse(this)[0] - parseInt(that.selectangle.attr('x'));
            height = d3.mouse(this)[1] - parseInt(that.selectangle.attr('y'));

            // the below does nothing for right --> left selecting (intentional for now)
            if (width >= 0) {
                that.selectangle.attr('width', width)
            }

            if (height >= 0) {
                that.selectangle.attr('height', height)
            }
        };
    };

    /**
     * Closure on drag end function for dragging that makes this (the plot) 'that'
     * @returns {Function} - the function that should be called when a d3.drag end occurs
     */
    dragEnd() {
        const that = this;

        return function() {
            let x, y;

            let xStart = parseInt(that.selectangle.attr('x'));
            let yStart = parseInt(that.selectangle.attr('y'));
            let xEnd = xStart + parseInt(that.selectangle.attr('width'));
            let yEnd = yStart + parseInt(that.selectangle.attr('height'));

            if (d3.event.sourceEvent.shiftKey) {
                // update the axes to show only what was selected
                let yStartHold = yStart;  // hold on to value to allow re-assignment w/o conflict

                xStart = that.xScale.invert(xStart);
                yStart = that.yScale.invert(yEnd);  // **yEnd/yStart reversed because SVG axes behavior
                xEnd = that.xScale.invert(xEnd);
                yEnd = that.yScale.invert(yStartHold);  // **yEnd/yStart reversed because SVG axes behavior

                if (xStart < that.limits.xMin || xEnd > that.limits.xMax) {
                    // out-of-bounds default to the min and max
                    xStart = that.limits.xMin;
                    xEnd = that.limits.xMax;
                } else if (xEnd - xStart < that.xZoomLimit) {
                    // smaller than constant zoomLimit? Change limits to +/- half the zoom limit
                    let xAvg = (xEnd.valueOf() + xStart.valueOf()) / 2;

                    xStart = new Date(xAvg - that.xZoomLimit / 2);
                    xEnd = new Date(xAvg + that.xZoomLimit / 2);
                }

                that.updateAxes(xStart, xEnd, yStart, yEnd);
            } else {
                // select all the points inside the rect and click them
                const points = that.graph.selectAll(`.${that.CSS.dataPointClass}`)
                    .filter((d, i, n) => {
                        x = n[i].cx.baseVal.value;
                        y = n[i].cy.baseVal.value;
                        return ((x >= xStart && x <= xEnd) && (y >= yStart && y <= yEnd));
                    });

                // update points, and remove already-selected points in box IFF the alt-key is held
                points.each((d, i, n) => that.updateClicked(n[i], d3.event.sourceEvent.altKey));
            }

            that.selectangle.style('opacity', 0);
            that.selectangle.attr('width', 1);
            that.selectangle.attr('height', 1);
        };
    };

    processAxis(data, attr, minVal, maxVal, minElement, maxElement, isDate=false, round=1) {
        let scale;
        if (isDate) {
            if (!minVal) {
                minVal = d3.min(data, (d) => Math.min(attr(d)));
            }

            if (!maxVal) {
                maxVal = d3.max(data, (d) => Math.max(attr(d)));
            }

            minVal = new Date(minVal);
            maxVal = new Date(maxVal);

            scale = d3.scaleTime()
                    .domain([minVal, maxVal])
                    .range([this.margins.left, this.graphWidth - this.margins.right]);

            this.elements[minElement].value = minVal.toISOString().split('T')[0] + 'T00:00';
            this.elements[maxElement].value = maxVal.toISOString().split('T')[0] + 'T00:00';

        } else {
            if (!maxVal) {
                d3.min(data, (d) => Math.min(attr(d)));
                maxVal = Math.ceil(d3.max(data, (d) => Math.max(attr(d))) / round) * round;
            }

            if (!minVal) {
                minVal = Math.floor(d3.min(data, (d) => Math.min(attr(d))) / round) * round;
            }

            scale = d3.scaleLinear()
                .domain([minVal, maxVal])
                .range([this.graphHeight - this.margins.top, this.margins.bottom]).clamp(true).nice();

            this.elements[minElement].value = scale.domain()[0];
            this.elements[maxElement].value = scale.domain()[1];
        }

        return [minVal, maxVal, scale]
    }

    /**
     * Create the scales for this plot.
     *
     * Returns the limits in an object, as well as the scale objects so they can be used elsewhere.
     *
     * @param {object} data - the data as loaded from JSON; used for determining limits if none given
     * @param [xMin=Null] - the new min value for the x axis (must be a valid input to new Date(xMin))
     * @param [xMax=Null] - the new max value for the x axis (must be a valid input to new Date(xMax))
     * @param [yMin=Null] - the new min value for the y axis
     * @param [yMax=Null] - the new max value for the y axis
     * @param {number} yRound - unit of y-axis that display values should be rounded to
     * @returns {[ScaleTime<number, number>, ScaleLinear<number, number>, {yMin: *, yMax: *, xMax: *, xMin: *}]}
     */
    createScales(data, xMin=null, xMax=null, yMin=null, yMax=null, yRound=this.yRound) {
        let xScale, yScale, xName, yName, limits, limitStack, stackHeight;

        xName = reverseKeyLookup(this.xOptions, this.dataXDefault);
        yName = reverseKeyLookup(this.yOptions, this.dataYDefault);

        limitStack = this.zoomHistory.get(this.previousCompound).get(this.joinXYStrings(xName, yName));

        if (xMin == null || xMax == null || yMin == null || yMax == null) {
            // if no limits given, peek at stack and use those if available
            stackHeight = limitStack.length;
            if (stackHeight !== 0) {
                limits = limitStack[stackHeight - 1];
                xMin = limits.xMin;
                xMax = limits.xMax;
                yMin = limits.yMin;
                yMax = limits.yMax;
            }
        }

        [xMin, xMax, xScale] = this.processAxis(data, this.dataXDefault, xMin, xMax, "xMin",
            "xMax", true);
        [yMin, yMax, yScale] = this.processAxis(data, this.dataYDefault, yMin, yMax, "yMin",
            "yMax", false);

        limits = {xMin, xMax, yMin, yMax};

        stackHeight = limitStack.length;

        // only put limits on stack if empty or top != limits
        if (stackHeight !== 0) {
            if (!this.areLimitsEqual(limits, limitStack[stackHeight - 1])) {
                limitStack.push(limits);
            }
        } else {
            limitStack.push(limits);
        }

        return [xScale, yScale, limits];
    };

    areLimitsEqual(lim1, lim2) {
        return (
            lim1.xMin.valueOf() === lim2.xMin.valueOf()
            && lim1.xMax.valueOf() === lim2.xMax.valueOf()
            && lim1.yMin === lim2.yMin
            && lim1.yMax === lim2.yMax
        )
    }

    /**
     * Render the plot in the DOM
     *
     * @param {string} compound - Compound to look up in the object containing JSON filenames or API calls
     * @param {number|null} [xMin=Null] - the new min value for the x axis (must be a valid input to new Date(xMin))
     * @param {number|null} [xMax=Null] - the new max value for the x axis (must be a valid input to new Date(xMax))
     * @param {number|null} [yMin=Null] - the new min value for the y axis
     * @param {number|null} [yMax=Null] - the new max value for the y axis
     */
    render(compound, xMin=null, xMax=null, yMin=null, yMax=null) {

        let filename = JSONFiles[compound];  // array defined in an in-html script b/c django templating

        this.selectedDates = this.selectionsByCompound.get(compound);

        d3.json(filename).then(data => {
            let xScale, yScale, limits, xAxis, yAxis;

            for (let opt of Object.keys(this.xOptions)) {
                data.forEach(d => {d[opt] = new Date((d[opt] + (60 * 60 * this.UTCoffset)) * 1000)})
            }

            [xScale, yScale, limits] = this.createScales(data, xMin, xMax, yMin, yMax);

            // this allows Class-wide access for things like drag events on the svg;
            // **BUT only because it's illogical for render() not to be called prior to a drag event on the svg
            this.xScale = xScale;
            this.yScale = yScale;
            this.limits = limits;

            // filter data to display for only those inisde the axis limits
            data = data.filter(d => {
                return dataXDefault(d) >= this.limits.xMin && dataXDefault(d) <= this.limits.xMax
                    && this.dataYDefault(d) >= this.limits.yMin && this.dataYDefault(d) <= this.limits.yMax;
            });

            const circles = this.graph.selectAll('circle').data(data);

            xAxis = d3.axisBottom(this.xScale).tickFormat(this.timeFormat);
            yAxis = d3.axisLeft(this.yScale);

            circles.exit().remove();  // remove all first

            circles.attr('r', 3)
                .attr('cx', d => this.xScale(this.dataXDefault(d)))
                .attr('cy', d => this.yScale(this.dataYDefault(d)))
                // remove class to ensure compound to compound plot separation
                .classed(this.CSS.selectedOutlierClass, false)
                .classed(this.CSS.dataPointClass, true);

            circles.enter().append('circle')
                .attr('r', 3)
                .attr('cx', d => this.xScale(this.dataXDefault(d)))
                .attr('cy', d => this.yScale(this.dataYDefault(d)))
                // remove class to ensure compound to compound plot separation
                .classed(this.CSS.selectedOutlierClass, false)
                // give class only to data so it can be selected later
                .attr('class', this.CSS.dataPointClass)
                .on('mouseover', (d, i, n) => this.handleMouseOver(d, i, n))
                .on('mouseout', this.wrapMouseOut());

            this.xAxisGroup.call(xAxis);  // call the axes functions on the respective groups
            this.yAxisGroup.call(yAxis);

            this.xAxisGroup.selectAll('text')  // select all text in the x axis
                .classed(this.CSS.axisTextClass, true)
                .attr('transform', 'rotate(-40)')
                .attr('text-anchor', 'end');  // rotate 40* from the end of the text

            this.yAxisGroup.selectAll('text')
                .classed(this.CSS.axisTextClass, true);

            this.xAxisGroup.selectAll(['line', 'path'])
                .classed(this.CSS.axisLinesClass, true);

            this.yAxisGroup.selectAll(['line', 'path'])
                .classed(this.CSS.axisLinesClass, true);

            const points = this.graph.selectAll(`.${this.CSS.dataPointClass}`)
                .filter((d) => {
                    return this.selectedDates.has(this.formatISODate(this.dataXDefault(d), d[this.toolTipSalt]))
                });

            points.each((d, i, n) => this.updateClicked(n[i]));

        });

        // update all text boxes once render is otherwise complete
        this.updateTextBoxes(this.selectedDates);
    };

    /**
     * Closure returning the function at make the SVG responsive.
     *
     * Width and height are given, and the aspect ratio is preserved on any change in size of the parent container.
     * @returns {Function}
     */
    makeResponsive = () => {
        const that = this;

        return function(svg) {
            const container = d3.select(svg.node().parentNode);
            const w = parseInt(svg.style('width'), 10);
            const h = parseInt(svg.style('height'), 10);

            that.ratio = h / w;

            svg.attr('viewBox', `0 0 ${w} ${h}`)
                .attr('preserveAspectRatio', 'xMidYMid meet')
                .call(resize);

            d3.select(window).on(`resize.${container.attr('id')}`, resize);

            /** SVG-resizer called on every occurence of the parent container resizing*/
            function resize() {
                let tgtWidth = parseInt(container.style('width'), 10);

                svg.attr('width', tgtWidth)
                    .attr('height', tgtWidth * that.ratio);  // resize based on ratio
            }
        }
    };

    /**
     * Update a clicked item, potentially remov
     * @param item - data point to be
     * @param {boolean} removeOnDupe -
     */
    updateClicked(item, removeOnDupe=false) {
        let clicked = d3.select(item);

        let date = clicked.datum().date;
        let selectedDate = this.formatISODate(date, clicked.datum()[this.toolTipSalt]);  // get, then format the date

        if ((this.selectedDates.has(selectedDate)) && (removeOnDupe)) {
            // add or remove, depending on if it's in the set already

            clicked.classed(this.CSS.selectedOutlierClass, false);  // toggle class

            this.selectedDates.delete(selectedDate);
            this.selectionsByDate.get(selectedDate).delete(this.previousCompound);

            if (this.selectionsByDate.get(selectedDate).size === 0) {
                this.selectionsByDate.delete(selectedDate);
            }

        } else {
            clicked.classed(this.CSS.selectedOutlierClass, true);  // toggle class
            this.selectedDates.add(selectedDate);
        }

        this.commitSelections(this.previousCompound);
    };

    /**
     * Handle a mouse-over of a data point
     *
     * Style the point as slightly larger and add a dark grey border to show selection.
     *
     * @param d - the moused-over data point
     * @param i - the index of the moused-over data point in all the data
     * @param n - all the related objects in an array
     */
    handleMouseOver(d, i, n) {
        d3.select(n[i]).raise() // raise to bring element to front; format element
            .attr('r', 4)
            .attr('stroke', 'darkslategrey')
            .attr('stroke-width', '2');

        const divText = this.toolTipText(this, d)

        this.toolTipGroup.raise().style('opacity', 1);

        this.toolTip.style('left', d3.event.pageX + 15 +'px')
            .style('top', d3.event.pageY + 20 + 'px');

        this.toolTip.html(divText);
    };

    /**
     * Select the event (this) to apply a transition, then call plot (that).handleMouseOut() to effect styling.
     *
     * Closure to provide the plot (this) as 'that' to the function for mouse-out events
     *
     * @returns {Function}
     */
    wrapMouseOut = () => {
        const that = this;

        return function() {
            d3.select(this).transition()
                .duration('150')
                .attr('r', 3)
                .attr('stroke-width', 0);

            that.handleMouseOut();
        }
    };

    /** Make the entire toolTipGroup invisible on mouse-out*/
    handleMouseOut() {
        this.toolTipGroup.style('opacity', 0);
    };

    /**
     * Add listeners to all UI elements that require one
     */
    initListeners() {
        this.elements.selector.addEventListener('change', (e) => {

            this.commitSelections(this.previousCompound);
            let compound = e.target.value;

            this.render(compound);
            this.previousCompound = compound;
        });

        this.elements.ySelector.addEventListener('change', (e) => {
            this.dataYDefault = this.yOptions[e.target.value];
            this.render(this.previousCompound);  // TODO: probably better to pass Y into render than set at class level
        });

        this.elements.xSelector.addEventListener('change', (e) => {
            this.dataXDefault = this.xOptions[e.target.value];
            this.render(this.previousCompound);  // TODO: probably better to pass Y into render than set at class level
        });

        for (let input of [this.elements.xMin, this.elements.xMax,
                            this.elements.yMin, this.elements.yMax]) {
            input.addEventListener('change', () => {
                this.updateAxes(this.elements.xMin.value, this.elements.xMax.value,
                    this.elements.yMin.value, this.elements.yMax.value)
            });

            // loop works because no this/event is used, so closures and targetting are a non-issue
        }

        this.buttons.saveSelect.addEventListener('click',
            () => this.commitSelections(this.elements.selector.value));
        this.buttons.downloadJSON.addEventListener('click', this.getJSONfile.bind(this));
        this.buttons.clearPlot.addEventListener('click',
            () => this.cleanPlot(this.elements.selector.value));
        this.buttons.clearAll.addEventListener('click', this.totalRefresh.bind(this));
        this.buttons.resetAxes.addEventListener('click', () => this.updateAxes());
        this.buttons.undoZoom.addEventListener('click', () => {
            let xName = reverseKeyLookup(this.xOptions, this.dataXDefault);
            let yName = reverseKeyLookup(this.yOptions, this.dataYDefault);

            // pop the current limits off the stack and re-call updateAxes and re-render with no params;
            //  it will find the next-most-recent zoom on the stack (or default)
            this.zoomHistory.get(this.previousCompound).get(this.joinXYStrings(xName, yName)).pop();
            this.updateAxes();
        });
    };

    /**
     * Initialize variables or rest on a button-press
     */
    initVars() {
        for (let opt in this.elements.selector.options) {
            this.elements.selector.options.remove(0)
        }  // clear any options before re-populating on refresh or reset of all plots

        for (let c of this.compounds) {
            let option = document.createElement('option');
            option.value = c;
            option.textContent = c;
            this.elements.selector.appendChild(option);

            this.selectionsByCompound.set(c, new Set());  // init all compounds to the global map
        }

        for (let opt in this.elements.ySelector.options) {
            this.elements.ySelector.options.remove(0)
        }  // clear any options before re-populating on refresh or reset of all plots

        for (let opt of Object.keys(this.yOptions)) {
            let option = document.createElement('option');
            option.value = opt;
            option.textContent = opt;
            this.elements.ySelector.appendChild(option);
        }

        for (let opt in this.elements.xSelector.options) {
            this.elements.xSelector.options.remove(0)
        }  // clear any options before re-populating on refresh or reset of all plots

        for (let opt of Object.keys(this.xOptions)) {
            let option = document.createElement('option');
            option.value = opt;
            option.textContent = opt;
            this.elements.xSelector.appendChild(option);
        }

        let xName = reverseKeyLookup(this.yOptions, this.dataYDefault)
        let yName = reverseKeyLookup(this.xOptions, this.dataXDefault);
        this.elements.ySelector.value = xName;
        this.elements.xSelector.value = yName;

        this.zoomHistory.clear();  // clear in case this is a refresh

        for (let c of this.compounds) {
            this.zoomHistory.set(c, new Map());  // create a sub-map for each compound

            for (let xOpt of Object.keys(this.xOptions)) {
                for (let yOpt of Object.keys(this.yOptions)) {
                    this.zoomHistory.get(c).set(this.joinXYStrings(xOpt, yOpt), []);
                    // intialize every xy option combo to an empty array
                }
            }

        }

        this.selectionsByDate = new Map();  // these two required for totalRefresh() to work
        this.selectedDates = new Set();

        this.previousCompound = this.compounds[0];  // default to first compound in provided list

        this.render(this.previousCompound)
    };

    joinXYStrings(x, y) {
        return 'x' + x + '_y' + y;
    }

    /**
     * Format a Date object as an ISO string
     *
     * @param date - date to format
     * @param salt - string or stringable information to include after date
     * @returns {string} - formatted string of the ISO date and time, removing the timezone
     */
    formatISODate = (date, salt=null) => {
        date = date.toISOString();

        if (salt) {
            return date.replace('T', " ").slice(0, -8) + ' ' + salt;
        } else {
            return date.replace('T', " ").slice(0, -8);
        }

    };

    /**
     * Update text box of selected data, then call update of JSON text box after
     *
     * @param {Set} newTextSet - set containing the new text data to display
     */
    updateTextBoxes(newTextSet) {
        const texts = this.textBox.selectAll("p")
            .data(d3.set(Array.from(newTextSet).sort()).values());

        const textFunc = (d) => {
            let ct;
            // return the 'dateString (countOfCompoundsFilteredForThisDate)' like '2018-3-31 10:02 (3)'
            let globalEntry = this.selectionsByDate.get(d);

            // if not found in globalByDate yet, these changes haven't been saved...the count is technically 0 still
            ct = (globalEntry === undefined) ? 0 : globalEntry.size;

            return `${d} (${ct})`
        };

        texts.exit().remove();
        texts.text(d => textFunc(d));
        texts.enter().append("p").text(d => textFunc(d));

        this.updateJSONBox();
    };

    /**
     * Update the JSON text box using data contained in this.
     */
    updateJSONBox() {
        let compoundsInJSON = new Set();

        this.selectionsByCompound.forEach((value, key) => {
            if (value.size !== 0) {
                compoundsInJSON.add(key);
            }
        });

        // TODO: Sort is left out here for performance.
        // let content = new Map([...this.selectionsByDate.entries()].sort());

        let jsonContent = JSON.stringify(Object.fromEntries(this.selectionsByDate), this.mapReplacer, " ");

        jsonContent = this.regexReplace(jsonContent, '],', '],\n');

        d3.select(this.CSS.jsonTextBoxID).text(jsonContent);

        if (compoundsInJSON.size > 0) {
            d3.select(this.CSS.jsonListID).text(`Contains: {${[...compoundsInJSON].join(', ')}}`);
        } else {
            d3.select(this.CSS.jsonListID).text('');
        }
    };

    /**
     * Commit temporary selections to variables (not just selectionsByCompound), and call update of text boxes
     *
     * @param {string} compound - compound to commit selections of; usually the active compound
     */
    commitSelections(compound) {
        let compoundSet = this.selectionsByCompound.get(compound);

        for (let d of this.selectedDates) {

            let dateSet = this.selectionsByDate.get(d);

            if (dateSet === undefined) {
                this.selectionsByDate.set(d, new Set());
            }

            this.selectionsByDate.get(d).add(compound);
            compoundSet.add(d);
        }

        this.updateTextBoxes(compoundSet);
    };

    /**
     * Finalize JSON data and allow it to be downloaded by the user
     */
    getJSONfile() {
        this.commitSelections(this.elements.selector.value);

        function downloadFile(content, filename, contentType='text/plain') {
            let file = new Blob([content], {type: contentType});  // blob to create file contents
            let a = document.createElement('a');
            // create anchor then assign temporary URL and download immediately
            a.href = URL.createObjectURL(file);
            a.click();
            URL.revokeObjectURL(a.href);  // remove from browser since it's temporary
        }

        let c = new Map([...this.selectionsByDate.entries()].sort());

        let content = JSON.stringify(Object.fromEntries(c), this.mapReplacer, " ");
        content = this.regexReplace(content, '],', '],\n');

        downloadFile(content, 'output.json')
    };

    /**
     * Clear the plot of a compound of any selections, and remove selections from UI and data
     *
     * @param {string} compound - compound that should have it's plot and selections cleared/reset
     */
    cleanPlot(compound) {
        let compoundSet = this.selectionsByCompound.get(compound);

        for (let d of compoundSet) {
            let dateSet = this.selectionsByDate.get(d);

            if (dateSet !== undefined) {
                this.selectionsByDate.get(d).delete(compound);

                if (this.selectionsByDate.get(d).size === 0) {
                    this.selectionsByDate.delete(d);
                }
            }
        }

        compoundSet.clear();
        this.render(compound);
    };

    /**
     * Completely refresh data in UI, removing any selections and re-initializing variables; re-render
     */
    totalRefresh() {
        this.initVars();

        this.elements.selector.value = this.compounds[0];
        this.elements.selector.dispatchEvent(new Event('change'));
        // change value and manually issue event change to trigger
    };

    /**
     * Replacer to allow maps to be JSON.stringify'd
     *
     * @param key
     * @param value
     * @returns
     */
    mapReplacer = (key, value) => {
        if(value instanceof Map || value instanceof Set) {
            return [...value]
        }
        return value
    };

    /**
     * Utility function for replacing all occurences of a string based on a regex search.
     *
     * @param str
     * @param search
     * @param replacement
     * @returns {String|*|string|void}
     */
    regexReplace = (str, search, replacement) => str.replace(new RegExp(search, 'g'), replacement);
}

function reverseKeyLookup(obj, value) {
    return Object.keys(obj).find(k=>obj[k]===value)
}
