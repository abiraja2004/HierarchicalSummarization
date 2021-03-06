// An object to define utility functions and global variables on:
$.annotationGlobVars = {};
// An object to define internal stuff for the plugin:
$.annotationGlobVars.awaitingClosingSegment = false;
// after clicking on the first segment, save its ID
$.annotationGlobVars.openingSegmentId = null;
// what is the parent argument of the clicked segment
$.annotationGlobVars.openingArgumentDivId = null;
// map (argumentId: map selected sentences)
$.annotationGlobVars.selectedSentences = {};

// data container for submitting
$.annotationGlobVars.allCollectedAnnotations = {};

/**
 * Concatenates text content from the given array
 */
function concatenateSentenceText(sentences) {
    return sentences.map(function () {
        return $(this).text();
    }).get().join(' ');
}

/**
 * Shows the current tooltip
 */
function updateTooltipPanel() {
    // show the current tooltip
    if ($.annotationGlobVars.awaitingClosingSegment) {
        // show info panel that
        var tooltipDiv = $("#" + $.annotationGlobVars.openingArgumentDivId).find(".tooltipbox");

        tooltipDiv.find(".tooltipText").first().text("Now click on the last word of the text segment to be selected. If necessary, you can delete a segment later.");
        tooltipDiv.show(300);
    } else {
        // hide all tooltips by default
        $(".tooltipbox").hide(100);
    }
}

/**
 * Deletes an existing annotation for a given argument
 */
function removeAnnotatedSegment(argumentID, openingSegmentPosition) {
    // some sanity checking
    if (!$.annotationGlobVars.selectedSentences[argumentID]) {
        alert("Inconsistent state; trying to delete annotations for " + argumentID + " which has no annotations");
        return;
    }

    if ($.annotationGlobVars.awaitingClosingSegment) {
        alert("You must first finish selecting the current segment before taking any further action");
        return;
    }

    // and delete
    delete $.annotationGlobVars.selectedSentences[argumentID][openingSegmentPosition];

    // don't forget to update view
    updateView(argumentID);
}


/**
 * Shows all currently annotated segments for the given argument in the box
 * @param argumentID argument
 */
function updateCurrentSelectionPanel(argumentID) {
    var ul = $("#" + argumentID).find("div.selectedSegments ul");

    // clear the panel first
    ul.empty();

    // list all selected segments in the container
    // iterate over map of {firstSentencePosition: [sentence]}
    jQuery.each($.annotationGlobVars.selectedSentences[argumentID], function (openingSegmentPosition, sentences) {
        // concatenate text from all sentences from this segment
        var li = $("<li></li>").text(concatenateSentenceText(sentences) + " ");

        // add "remove" button
        var button = $("<button></button>");
        button.addClass("btn btn-danger btn-xs");
        button.attr("type", "button");
        button.text("Delete");

        // add on-click action
        button.click(function () {
            removeAnnotatedSegment(argumentID, openingSegmentPosition);
        });

        li.append(button);
        ul.append(li);
    });
	//console.log($.annotationGlobVars.selectedSentences[argumentID]);

    // hide/show implicit claim option
    if ($.annotationGlobVars.selectedSentences[argumentID] && Object.keys($.annotationGlobVars.selectedSentences[argumentID]).length > 0) {
        // show annotation box in case it't hidden
        var selectedSegmentsDiv = $("#" + argumentID + "_selectedSegments");
        if (!selectedSegmentsDiv.is(":visible")) {
            selectedSegmentsDiv.show(400);
        }

        $("#" + argumentID).find("div.optional-box").hide();
        // un-check it
        $("#" + argumentID + "_checkbox").prop("checked", false);
     } else {
        $("#" + argumentID).find("div.optional-box").show(400);
     }
}

/**
 * Updates the annotations shown directly in the text; enables/disables, etc.
 * @param argumentID argument id
 */
function updateInTextAnnotations(argumentID) {
    // remove any existing annotations
    $("#" + argumentID).find(".sentence").each(function () {
        $(this).removeClass("hoverSegment");
        $(this).removeClass("annotationDisabled");
        $(this).removeClass("annotatedInText");
        $(this).removeClass("annotatedInTextSegmentStart");
    });

    // iterate over map of {firstSentencePosition: [sentence]}
    jQuery.each($.annotationGlobVars.selectedSentences[argumentID], function (i, sentences) {

        // set-up appropriate class for all annotated sentences
        jQuery.each(sentences, function (sentencePosition, sentence) {
//                        console.log("Setting properties for sentence " + sentence.id);
            $("#" + sentence.id).addClass("annotatedInText");
        });

        // the first sentence of each segment "deserves" a special style
        sentences.first().addClass("annotatedInTextSegmentStart");

    });
}

/**
 * Checks whether all stance-related radio groups are checked and whether
 * there is either a selection of segments done or a checkbox saying that there
 * are no explicit segments
 */
function validateFormAndUpdateCollectedResults() {
    // make sure all arguments have selected stance from the radio group
    var allOk = false;

    // check where all have stance to 0 or 1, and if so, whether the
    // sentences were highlighted or checked implicitness
    $('div.argument').each(function () {
        allOk |= validateSingleAnnotatedArgument($(this).attr("id"));
    });

    // update the field for collected results
    $("#collectedAnnotationResults").val(JSON.stringify($.annotationGlobVars.allCollectedAnnotations));
    // console.debug(JSON.stringify($.annotationGlobVars.allCollectedAnnotations));

    // update the submit button
    $("#submitButton").prop("disabled", !allOk);

}

/**
 * Validates if an argument is fully annotated, updates the global container with annotations
 * @param argumentID argument
 * @returns {boolean} true if we have all required annotations, false otherwise
 */
function validateSingleAnnotatedArgument(argumentID) {
    // update global container
    delete $.annotationGlobVars.allCollectedAnnotations[argumentID];
    $.annotationGlobVars.allCollectedAnnotations[argumentID] = {};

    // check whether the some groups have unfilled buttons
    var value = $("input[name=" + argumentID + "_stance_group]:checked").val();
    // console.log("Stance value: " + argumentID + ", " + stanceValue);
    // console.log("Validating: ");
    // console.log($.annotationGlobVars.selectedSentences[argumentID]);
    // update global container
    $.annotationGlobVars.allCollectedAnnotations[argumentID]["Value"] = value;

    // now look at implicitness
    var implicitClaim = false;
    if (value == 0 || value == 1) {
        implicitClaim = $("#" + argumentID + "_implicitStance").is(":checked");
    }
    $.annotationGlobVars.allCollectedAnnotations[argumentID]["implicitClaim"] = implicitClaim;


    // and look for annotations
    // empty array for segments; this will become an array of arrays
    $.annotationGlobVars.allCollectedAnnotations[argumentID]["segments"] = [];

    var hasAnnotations = false;
    jQuery.each($.annotationGlobVars.selectedSentences[argumentID], function (i, sentences) {
        hasAnnotations = true;

        // collecting IDs as array
        var spanIDs = sentences.map(function () {
            return $(this).attr("id");
        }).get();
        // and add them to the "segments" array
        $.annotationGlobVars.allCollectedAnnotations[argumentID]["segments"].push(spanIDs);
    });

    var result = false;
    // for known stance we need either implicit claim or annotations
    if (value == 1 || value == 0) {
        result = implicitClaim || hasAnnotations;
        //$'div.argument'.('#'+argumentID+'_stance_group').disabled == false; // deactivate checkbox!
    } else if (value == 2) { //checkbox is active
        // for unclear stance we don't need more
        result = ($('#'+argumentID+'_keywords').val() != '');
    }

    result = result ^ hasAnnotations;

    //console.log("Result: " + result + " Argument " + argumentID + ": stanceValue: " + stanceValue + ", implicitClaim: " + implicitClaim + ", hasAnnotations: " + hasAnnotations);
    return result;
}

/**
 * Updates view after each performed action
 * @param argumentId current argument id
 */
function updateView(argumentId) {
    updateTooltipPanel();
    updateCurrentSelectionPanel(argumentId);
    updateInTextAnnotations(argumentId);
    validateFormAndUpdateCollectedResults();
}

/**
 * Returns true if the currentSegmentPosition is allowed as a continuation of a newly
 * annotated segment starting with openingSegmentPosition; to prevent non-continous
 * annotations and allowing only consecutive sentence annotations
 * @param argumentID id
 * @param openingSegmentPosition position of the already clicked opening sentence
 * @param currentSegmentPosition current sentence element position
 * @returns {boolean} true if enabled, false otherwise
 */
function sentenceIsEnabledForAnnotation(argumentID, openingSegmentPosition, currentSegmentPosition) {
    // first, only consecutive sentences are allowed
    if (openingSegmentPosition > currentSegmentPosition) {
        return false;
    }

    // get positions and sort them
    var annotatedPositionsGreaterThanCurrent = [];

    // add also all disabled positions
    $("#" + argumentID).find(".sentence.segment-not-allowed").each(function () {
        var position = $(this).data("position");
        if (position >= openingSegmentPosition) {
            annotatedPositionsGreaterThanCurrent.push(position);
        }
    });

    jQuery.each($.annotationGlobVars.selectedSentences[argumentID], function (i, sentences) {
        // set-up appropriate class for all annotated sentences
        jQuery.each(sentences, function (sentencePosition, sentence) {
            var position = $("#" + sentence.id).data("position");
//                    var position = sentence.data("position");
            if (position >= openingSegmentPosition) {
                annotatedPositionsGreaterThanCurrent.push(position);
            }
        });
    });
    annotatedPositionsGreaterThanCurrent.sort();

    // and only if there are some other annotations and we're crossing their position
    return annotatedPositionsGreaterThanCurrent.length == 0 || currentSegmentPosition < annotatedPositionsGreaterThanCurrent[0];
}


function showOrHideSegmentAnnotations(radioButton) {
    var value = radioButton.val();

    // find the box for segments
    var argumentID = radioButton.data("argumentid");
    var selectedSegmentsDiv = $("#" + argumentID + "_selectedSegments");

    if (value == 2) {
        selectedSegmentsDiv.hide(400);

        // also remove any existing annotations here!
        $.annotationGlobVars.selectedSentences[argumentID] = {};
    } else {
        selectedSegmentsDiv.show(400);
    }

    // console.log("Clicked on value : " + stanceValue);
}


$(document).ready(function () {
    var $sentence = $(".sentence:not(.segment-not-allowed)");

    // generally we should show some action is available by showing underline on mouse enter
    $sentence.mouseenter(function () {
        $(this).toggleClass("sentenceHover");
    });
    $sentence.mouseleave(function () {
        $(this).removeClass("sentenceHover");
    });

    $sentence.mouseover(function () {
        if ($.annotationGlobVars.awaitingClosingSegment) {
            var currentSegmentPosition = $(this).data("position");
            var openingSegmentPosition = $("#" + $.annotationGlobVars.openingSegmentId).data("position");

            // console.log("hovered " + $(this).attr('id') + ", currentSegmentPosition: " +
            //     currentSegmentPosition + ", openingSegmentPosition: " + openingSegmentPosition +
            //     "openingArgumentDivId: " + $.annotationGlobVars.openingArgumentDivId);

            // now find all paragraphs between this hovered segment
            var parentDivId = $(this).parent().closest('div.argument').attr("id");

            if (parentDivId == $.annotationGlobVars.openingArgumentDivId) {
                if (sentenceIsEnabledForAnnotation($.annotationGlobVars.openingArgumentDivId, openingSegmentPosition, currentSegmentPosition)) {
                    var allSentences = $("#" + parentDivId).find(".sentence");
                    // first reset any highlighting for all
                    allSentences.removeClass("hoverSegment");

                    // and highlight only the active ones
                    allSentences.slice(openingSegmentPosition, currentSegmentPosition + 1).addClass("hoverSegment");
                } else {
                    // disable previous sentences
                    $(this).addClass("annotationDisabled");
                }
            }
        }
    });

    $sentence.click(function () {
        // get ID of the current argument
        var argumentId = $(this).parent().closest('div.argument').attr("id");

        var currentSegmentPosition = $(this).data("position");
        var clickedID = $(this).attr("id");

        // closing the currently "open" segment?
        if (!$.annotationGlobVars.awaitingClosingSegment) {

//                    console.log("State of awaiting is: " + $.annotationGlobVars.awaitingClosingSegment);
            if (sentenceIsEnabledForAnnotation(argumentId, currentSegmentPosition, currentSegmentPosition)) {

//                    console.log("Clicked on " + clickedID);
//                    console.log($("#" + clickedID).text());

                // save the ID
                $.annotationGlobVars.openingSegmentId = clickedID;

                // negating the awaitingClosingSegment lock
                $.annotationGlobVars.awaitingClosingSegment = true;

                // parent argument
                $.annotationGlobVars.openingArgumentDivId = $(this).parent().closest('div.argument').attr('id');

                // and instantly call mouse-over on the same segment to show highlighting on the current segment
                $(this).mouseover();

                // show tooltip
                updateTooltipPanel();
            }
        } else {
            var openingSegmentPosition = $("#" + $.annotationGlobVars.openingSegmentId).data("position");

            if (argumentId == $.annotationGlobVars.openingArgumentDivId &&
                sentenceIsEnabledForAnnotation($.annotationGlobVars.openingArgumentDivId, openingSegmentPosition, currentSegmentPosition)) {

                // negating the awaitingClosingSegment lock
                $.annotationGlobVars.awaitingClosingSegment = false;

                // create the segment
                var allSentences = $("#" + argumentId).find(".sentence");

                // and save the selected ones
                var selectedSentences = allSentences.slice(openingSegmentPosition, currentSegmentPosition + 1);

                // add them to the "global" selected map by argument id and opening position
                if (!$.annotationGlobVars.selectedSentences[argumentId]) {
                    $.annotationGlobVars.selectedSentences[argumentId] = {};
                }
                $.annotationGlobVars.selectedSentences[argumentId][openingSegmentPosition] = selectedSentences;

                // render view
                updateView(argumentId);
            }
        }

    });

    // wait for any radio button to change
    $("input:radio").change(function () {
        showOrHideSegmentAnnotations($(this));

        var argumentID = $(this).data("argumentid");
        updateCurrentSelectionPanel(argumentID);
        updateInTextAnnotations(argumentID);

        validateFormAndUpdateCollectedResults();
    });

    // wait for any radio button to change
    $("input:checkbox").change(function () {
        // if "non-stance" is chosen, we hide/show the block for explicit standpoint
        validateFormAndUpdateCollectedResults();
    });
    $(".argument input:text").keyup(function () {
        // if "non-stance" is chosen, we hide/show the block for explicit standpoint
        
        validateFormAndUpdateCollectedResults();
    });

});
