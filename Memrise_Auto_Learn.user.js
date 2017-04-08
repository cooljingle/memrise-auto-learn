// ==UserScript==
// @name           Memrise Auto Learn
// @namespace      https://github.com/cooljingle
// @description    Fast-track the growth level of words you are planting
// @match          https://www.memrise.com/course/*/garden/learn*
// @version        0.0.1
// @updateURL      https://github.com/cooljingle/memrise-auto-learn/raw/master/Memrise_Auto_Learn.user.js
// @downloadURL    https://github.com/cooljingle/memrise-auto-learn/raw/master/Memrise_Auto_Learn.user.js
// @grant          none
// ==/UserScript==

$(document).ready(function() {
    function insertAutoLearn() {
        $('.hint').last().append("<span style='position: absolute; right: -105px'>Auto learn<input id='autoLearn' style='margin-left: 5px; margin-bottom: 3px' type='checkbox'></span>");
        $('#autoLearn').change(function(){
            MEMRISE.garden.boxes.current().autoLearn = $(this).is(':checked');
        });
    }

    function getValue(formData, name) {
        var regex = new RegExp(name + "=([^&]+)");
        var match = (formData || "").match(regex);
        return match && match[1];
    }

    MEMRISE.garden.boxes.load = (function() {
        var cached_function = MEMRISE.garden.boxes.load;
        return function() {
            var autoLearnedId;
            function clearAutoLearnedFutures(){
                if(autoLearnedId) {
                    MEMRISE.garden.boxes.num--;
                    MEMRISE.garden.boxes.remove_all_future_matching({
                        thing_id: autoLearnedId
                    });
                    MEMRISE.garden.boxes.num++;
                    autoLearnedId = undefined;
                    MEMRISE.garden.boxes.reorder_future_to_be_interesting();
                }
            }

            MEMRISE.garden.register = (function() {
                var cached_function = MEMRISE.garden.register;
                return function() {
                    var thinguser = arguments[0];
                    if(arguments[1] && thinguser.autoLearn){
                        autoLearnedId = thinguser.thing_id;
                    }
                    return cached_function.apply(this, arguments);
                };
            }());

            MEMRISE.garden.boxes.activate_box = (function() {
                var cached_function = MEMRISE.garden.boxes.activate_box;
                return function() {
                    clearAutoLearnedFutures();
                    var canAutoLearn = MEMRISE.garden.boxes.current().learn_session_level < 6;
                    var result = cached_function.apply(this, arguments);
                    if(canAutoLearn) {
                        insertAutoLearn();
                    }
                    return result;
                };
            }());

            return cached_function.apply(this, arguments);
        };
    }());

    $(document).ajaxSuccess(
        function(event, request, settings) {
            var thinguser = request.responseJSON && request.responseJSON.thinguser,
                correctAnswer = getValue(settings.data, "score") === "1",
                canUpdate = getValue(settings.data, "update_scheduling") !== "false",
                box = thinguser && _.findLast(MEMRISE.garden.boxes._list, {
                    answered: true,
                    thing_id: thinguser.thing_id,
                    column_a: thinguser.column_a,
                    column_b: thinguser.column_b,
                    autoLearn: true
                }),
                isValidRequest = !!(thinguser && correctAnswer && canUpdate && box && thinguser.growth_level < 6);

            if (isValidRequest) {
                var hasGrown = getValue(settings.data, "growth_level") != thinguser.growth_level;
                settings.data = settings.data.replace(/points=\d+(&growth_level=\d+){0,1}/, "points=0&growth_level=" + thinguser.growth_level);
                if(hasGrown){
                    var autoLearnCount = thinguser.growth_level - (box.thinguser === null ? 0 : box.thinguser.growth_level) + 1;
                    MEMRISE.garden.stats.show_message("Auto Learn +" + autoLearnCount);
                }
                $.post(settings.url, settings.data);
            }
        }
    );
});
