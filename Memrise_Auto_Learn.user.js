// ==UserScript==
// @name           Memrise Auto Learn
// @namespace      https://github.com/cooljingle
// @description    Fast-track the growth level of words you are planting
// @match          https://www.memrise.com/course/*/garden/learn*
// @version        0.0.3
// @updateURL      https://github.com/cooljingle/memrise-auto-learn/raw/master/Memrise_Auto_Learn.user.js
// @downloadURL    https://github.com/cooljingle/memrise-auto-learn/raw/master/Memrise_Auto_Learn.user.js
// @grant          none
// ==/UserScript==

$(document).ready(function() {
    var localStorageKeyIdentifier = "memrise-audio-learn-key",
        shortcutKeyCode = JSON.parse(localStorage.getItem(localStorageKeyIdentifier)) || 113, //corresponds to F2 but you can replace this with your own shortcut key; see http://keycode.info/,
        linkHtml = `<a data-toggle='modal' data-target='#auto-learn-modal'>Auto Learn</a>`,
        modalHtml =
        `
<div class='modal fade' id='auto-learn-modal' tabindex='-1' role='dialog'>
    <div class='modal-dialog' role='document'>
        <div class='modal-content'>
            <div class='modal-header'>
                <button type='button' class='close' data-dismiss='modal'><span >×</span></button>
                <h1 class='modal-title' id='all-typing-modal-label'>Auto Learn Settings</h1>
            </div>
            <div class='modal-body'>
                <div>
                    <h4>Shortcut key code:</h4>
                    <input id='auto-learn-key' type='text'  style="width:60px;height:20px" maxlength="3">
                    <em style='font-size:85%'>Default is 113 (F2); see http://keycode.info/ for other codes</em>
                </div>
            </div>
        </div>
    </div>
</div>
`;

    $("body").append(modalHtml);
    $('#left-area').append(linkHtml);
    $('#auto-learn-modal').on('shown.bs.modal', function() {
        $(document).off('focusin.modal'); //enable focus events on modal
    });
    $('#auto-learn-key')
        .val(shortcutKeyCode)
        .change(function () {
            shortcutKeyCode = Number($(this).val());
            localStorage.setItem(localStorageKeyIdentifier, $(this).val());
        });

    $(window).keydown(function(e) {
        if(e.which === shortcutKeyCode) {
            $('#autoLearn').trigger('click');
        }
    });

    function insertAutoLearn() {
        $('.js-plant-ico').first().append(`
           <div id="autoLearn" class="ico-growth lev6 due-for-review" style="top: 120px;zoom: 0.5;cursor: pointer" title="Auto learn">
               <div id="autoLearnStatus" style="top: 32px;position: absolute;width: 100px;zoom: 1.5;right: -27px;color: darkgrey">Auto learn OFF</div>
           </div>
        `);

        $('#autoLearn').click(function(){
            var autoLearn = !MEMRISE.garden.boxes.current().autoLearn;
            MEMRISE.garden.boxes.current().autoLearn = autoLearn;
            $(this).toggleClass("due-for-review");
            $('#autoLearnStatus')
                .css('color', autoLearn ? 'limegreen' : 'darkgrey')
                .text(autoLearn ? 'Auto learn ON' : 'Auto learn OFF');
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
                    if(thinguser.autoLearn){
                        if(arguments[1] === 1) {
                            autoLearnedId = thinguser.thing_id;
                        } else {
                            thinguser.autoLearn = false;
                        }
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
