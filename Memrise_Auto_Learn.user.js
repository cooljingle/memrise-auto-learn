// ==UserScript==
// @name           Memrise Auto Learn
// @namespace      https://github.com/cooljingle
// @description    Fast-track the growth level of words you are planting
// @match          https://www.memrise.com/course/*/garden/learn*
// @match          https://app.memrise.com/course/*/garden/learn*
// @version        0.0.13
// @updateURL      https://github.com/cooljingle/memrise-auto-learn/raw/master/Memrise_Auto_Learn.user.js
// @downloadURL    https://github.com/cooljingle/memrise-auto-learn/raw/master/Memrise_Auto_Learn.user.js
// @grant          none
// ==/UserScript==

$(document).ready(function() {
    var localStorageKeyIdentifier = "memrise-auto-learn-key",
        localStorageDefaultIdentifier = "memrise-auto-learn-default",
        autoLearnedBoxes = [],
        flashLoadCount = 0,
        shortcutKeyCode = JSON.parse(localStorage.getItem(localStorageKeyIdentifier)) || 113, //corresponds to F2 but you can replace this with your own shortcut key; see http://keycode.info/,
        autoLearnByDefault = localStorage.getItem(localStorageDefaultIdentifier) === "true",
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
                <br>
                <div>
                    <span>Auto learn by default: </span>
                    <input id='auto-learn-default' type="checkbox" style='vertical-align: text-top; margin-left: 5px'>
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
    $('#auto-learn-default').prop('checked', autoLearnByDefault);
    $('#auto-learn-default').change(function () {
        var checked = $(this).is(':checked');
        autoLearnByDefault = checked;
        if(MEMRISE.garden.box.learnable.autoLearn !== autoLearnByDefault)
            toggleAutoLearn();
        localStorage.setItem(localStorageDefaultIdentifier, checked);
    });

    $(window).keydown(function(e) {
        if(e.which === shortcutKeyCode) {
            toggleAutoLearn();
        }
    });

    function insertAutoLearn() {
        $('.js-plant-ico').first().append(`
<div id="autoLearn" class="ico-growth lev6 due-for-review" title="Auto learn" style="
top: 60px;
transform: scale(0.5);
transform-origin: top right;
-moz-transform: scale(0.5);
-moz-transform-origin: top right;
cursor: pointer">
    <div id="autoLearnStatus" style="
    top: 52px;
    position: absolute;
    width: 100px;
    transform: scale(1.5);
    transform-origin: top right;
    -moz-transform: scale(1.5);
    -moz-transform-origin: top right;
    right: -40px;"></div>
</div>
`);
        setAutoLearnStyles(MEMRISE.garden.box.learnable.autoLearn);

        $('#autoLearn').click(toggleAutoLearn);
    }

    function toggleAutoLearn() {
        var autoLearn = MEMRISE.garden.box.learnable.autoLearn = !MEMRISE.garden.box.learnable.autoLearn;
        setAutoLearnStyles(autoLearn);
    }

    function setAutoLearnStyles(autoLearn) {
        $('#autoLearnStatus')
            .css('color', autoLearn ? 'limegreen' : 'darkgrey')
            .text(autoLearn ? 'Auto learn ON' : 'Auto learn OFF');
    }

    function getValue(formData, name) {
        var regex = new RegExp(name + "=([^&]+)");
        var match = (formData || "").match(regex);
        return match && match[1];
    }

    MEMRISE.garden._events.start.push(() => {
        //clears future boxes for us
        MEMRISE.garden.shouldFullyGrow = function(thinguser, learnable) {
            return learnable.autoLearn;
        };

        MEMRISE.garden.register = (function() {
            var cached_function = MEMRISE.garden.register;
            return function() {
                var box = arguments[0];
                if(box.learnable.autoLearn){
                    if(arguments[1] === 1) {
                        box.initialGrowthLevel = box.thinguser.growth_level;
                        autoLearnedBoxes.push(box);
                    } else {
                        box.learnable.autoLearn = false;
                    }
                }
                return cached_function.apply(this, arguments);
            };
        }());

        MEMRISE.garden.session.make_box = (function() {
            var cached_function = MEMRISE.garden.session.make_box
            return function() {
                var result = cached_function.apply(this, arguments);
                var canAutoLearn = arguments[0].learn_session_level < 6;
                if(canAutoLearn) {
                    result.learnable.autoLearn = autoLearnByDefault;
                    window.setTimeout(insertAutoLearn, 0);
                }
                return result;
            };
        }());
    });

    $(document).ajaxSuccess(
        function(event, request, settings) {
            var thinguser = request.responseJSON && request.responseJSON.thinguser,
                correctAnswer = getValue(settings.data, "score") === "1",
                canUpdate = getValue(settings.data, "update_scheduling") !== "false",
                box = thinguser && _.find(autoLearnedBoxes, b => b.learnable_id === thinguser.learnable_id),
                isValidRequest = !!(thinguser && correctAnswer && canUpdate && box && thinguser.growth_level < 6);

            if (isValidRequest) {
                var hasGrown = getValue(settings.data, "growth_level") != thinguser.growth_level;
                settings.data = settings.data.replace(/points=\d+(&growth_level=\d+){0,1}/, "points=0&growth_level=" + thinguser.growth_level);
                if(hasGrown){
                    var autoLearnCount = thinguser.growth_level - box.initialGrowthLevel + 1;
                    var element = $('#right-area').show().find('.message').show();
                    var message = $.parseHTML(`<div>Auto Learn +${autoLearnCount}</div>`);
                    element.hide().removeClass("animated");
                    $.doTimeout(100, function() {
                        element.html(message).show().addClass("animated");
                        flashLoadCount++;
                    });
                    $.doTimeout(1000, function() {
                        if(--flashLoadCount === 0) {
                            element.hide().removeClass("animated");
                        }
                    });
                }
                setTimeout(function(){
                    $.post(settings.url, settings.data);
                }, 300);
            }
        }
    );
});
