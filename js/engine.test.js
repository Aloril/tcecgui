// engine.test.js
// @author octopoulo <polluxyz@gmail.com>
// @version 2020-07-02
//
/*
globals
__dirname, expect, require, test
*/
'use strict';

let {create_module} = require('./create-module');

let IMPORT_PATH = __dirname.replace(/\\/g, '/'),
    OUTPUT_MODULE = `${IMPORT_PATH}/test/engine+`;

create_module(IMPORT_PATH, [
    'common',
    //
    'engine',
], OUTPUT_MODULE, 'Assign DEFAULTS Keys TYPES X_SETTINGS Y y_states');

let {
    add_history, Assign, create_field_value, create_page_array, create_url_list, DEFAULTS, guess_types, import_settings,
    Keys, merge_settings, reset_settings, restore_history, sanitise_data, save_option, TYPES, X_SETTINGS, Y, y_states,
} = require(OUTPUT_MODULE);

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// add_history
[
    {chat_height: 10, twitch_chat: 1},
].forEach((y, id) => {
    test(`add_history:${id}`, () => {
        let length = y_states.length;
        Assign(Y, y);
        add_history();
        expect(y_states.length).toBe(length + 1);
    });
});

// create_field_value
[
    ['G#', ['g', 'G#']],
    ['wev=Ev', ['wev', 'Ev']],
    ['White', ['white', 'White']],
    ['Final decision', ['final_decision', 'Final decision']],
    ['W.ev', ['w_ev', 'W.ev']],
    ['Wins [W/B]', ['wins', 'Wins [W/B]']],
    ['Diff [Live]', ['diff', 'Diff [Live]']],
    ['a_b=A=B', ['a_b', 'A=B']],
    ['startTime', ['start_time', 'startTime']],
    ['BlackEv', ['black_ev', 'BlackEv']],
    ['# Games', ['games', '# Games']],
    ['{Game}#', ['game', '{Game}#']],
].forEach(([text, answer], id) => {
    test(`create_field_value:${id}`, () => {
        expect(create_field_value(text)).toEqual(answer);
    });
});

// create_page_array
[
    [1, 0, 0, [2]],
    [2, 0, 0, [2, 2]],
    [3, 0, 0, [2, 2, 2]],
    [4, 0, 0, [2, 2, 2, 2]],
    [5, 0, 0, [2, 2, 2, 2, 2]],
    [6, 0, 0, [2, 2, 2, 0, 1, 2]],
    [7, 0, 0, [2, 2, 2, 0, 0, 1, 2]],
    [8, 0, 0, [2, 2, 2, 0, 0, 0, 1, 2]],
    [9, 0, 0, [2, 2, 2, 0, 0, 0, 0, 1, 2]],
    [9, 1, 0, [2, 2, 2, 0, 0, 0, 0, 1, 2]],
    [9, 2, 0, [2, 2, 2, 0, 0, 0, 0, 1, 2]],
    [9, 3, 0, [2, 1, 0, 2, 0, 0, 0, 1, 2]],
    [9, 4, 0, [2, 1, 0, 0, 2, 0, 0, 1, 2]],
    [9, 4, 1, [2, 1, 0, 0, 2, 2, 0, 1, 2]],
    [9, 4, 2, [2, 1, 0, 2, 2, 2, 0, 1, 2]],
    [9, 5, 2, [2, 1, 0, 0, 2, 2, 2, 2, 2]],
    [9, 6, 2, [2, 1, 0, 0, 2, 2, 2, 2, 2]],
    [9, 5, 4, [2, 2, 2, 2, 2, 2, 2, 2, 2]],
].forEach(([num_page, page, extra, answer], id) => {
    test(`create_page_array:${id}`, () => {
        expect(create_page_array(num_page, page, extra)).toEqual(answer);
    });
});

// create_url_list
[
    [null, ''],
    [{}, '<vert class="fastart"></vert>'],
    [{a: 1}, '<vert class="fastart"><hr></vert>'],
].forEach(([dico, answer], id) => {
    test(`create_url_list:${id}`, () => {
        expect(create_url_list(dico)).toEqual(answer);
    });
});

// guess_types
[
    [
        {
            div: '',
            game: 0,
            order: 'left|center|right',
            table_tab: {
                archive: 'season',
                live: 'stand',
            },
            timeout: 0.1,
            useful: true,
        },
        {
            div: 's',
            game: 'i',
            order: 's',
            table_tab: 'o',
            timeout: 'f',
            useful: 'b',
        },
    ],
    [
        {
            color: [{type: 'color'}],
            color2: '#ff0000',
            coord: [{x: 5, y: 8}],
            coord2: {x: 5, y: 8},
            name: [{type: 'text'}],
            name2: 'chess',
            ratio: [{step: 0.1, type: 'number'}],
            ratio2: 0.5,
            width: [{type: 'number'}],
            width2: 650,
        },
        {
            color: 's',
            color2: 's',
            coord: 'o',
            coord2: 'o',
            name: 's',
            name2: 's',
            ratio: 'f',
            ratio2: 'f',
            width: 'i',
            width2: 'i',
        },
    ],
].forEach(([settings, answer], id) => {
    test(`guess_types:${id}`, () => {
        guess_types(settings);
        Keys(answer).forEach(key => {
            expect(TYPES).toHaveProperty(key, answer[key]);
        });
    });
});

// import_settings
[
    [{}, true, {}],
    [{width: 100}, undefined, {width: 100}],
    [{height: '500px'}, undefined, {height: '500px', width: 100}],
].forEach(([data, reset, answer], id) => {
    test(`import_settings:${id}`, () => {
        import_settings(data, reset);
        Keys(answer).forEach(key => {
            expect(Y).toHaveProperty(key, answer[key]);
        });
    });
});

// merge_settings
[
    [{}, {}, {}, {}],
    [{advanced: {debug: ''}}, {advanced: {debug: ''}}, {debug: undefined}, {debug: undefined}],
    [
        {audio: {volume: [{min: 0, max: 10, type: 'number'}, 5]}},
        {
            advanced: {debug: ''},
            audio: {volume: [{min: 0, max: 10, type: 'number'}, 5]},
        },
        {debug: undefined, volume: 5},
        {debug: undefined, volume: 'i'}
    ],
    [
        {
            advanced: {key_time: [{min: 0, max: 1000, type: 'number'}, 0]},
            audio: {music: [['on', 'off'], 0]},
        },
        {
            advanced: {
                debug: '',
                key_time: [{min: 0, max: 1000, type: 'number'}, 0],
            },
            audio: {
                music: [['on', 'off'], 0],
                volume: [{min: 0, max: 10, type: 'number'}, 5],
            },
        },
        {debug: undefined, key_time: 0, music: 0, volume: 5},
        {debug: undefined, key_time: 'i', music: 'i', volume: 'i'},
    ],
].forEach(([x_settings, answer, answer_def, answer_type], id) => {
    test(`merge_settings:${id}`, () => {
        merge_settings(x_settings);
        expect(X_SETTINGS).toEqual(answer);
        Keys(answer_def).forEach(key => {
            expect(DEFAULTS).toHaveProperty(key, answer_def[key]);
        });
        Keys(answer_type).forEach(key => {
            expect(TYPES).toHaveProperty(key, answer_type[key]);
        });
    });
});

// reset_settings
[
    [{'language': 'fra', 'theme': 'dark'}, true, {language: '', theme: ''}],
].forEach(([data, reset, answer], id) => {
    test(`reset_settings:${id}`, () => {
        Assign(Y, data);
        reset_settings(data, reset);
        Keys(answer).forEach(key => {
            expect(Y).toHaveProperty(key, answer[key]);
        });
    });
});

// restore_history
[
    [{theme: 'light', volume: 5}, {theme: 'dark', volume: 10}],
].forEach(([y, y2], id) => {
    test(`restore_history:${id}`, () => {
        Assign(Y, y);
        add_history();
        Assign(Y, y2);
        add_history();
        Keys(y2).forEach(key => {
            expect(Y).toHaveProperty(key, y2[key]);
        });
        restore_history(-1);
        Keys(y).forEach(key => {
            expect(Y).toHaveProperty(key, y[key]);
        });
    });
});

// sanitise_data
[
    [{width: ''}, {width: 600}, {width: 'f'}, {width: 600}],
    [{width: '700.5'}, {width: 600}, {width: 'f'}, {width: 700.5}],
    [{width: '700.5'}, {width: 600}, {width: 'i'}, {width: 700}],
    [{width: 700.5}, {width: 600}, {width: 'i'}, {width: 700.5}],
    [{width: '700.5'}, {width: undefined}, {width: undefined}, {width: '700.5'}],
].forEach(([y, defaults, types, answer], id) => {
    test(`sanitise_data:${id}`, () => {
        Assign(Y, y);
        Assign(DEFAULTS, defaults);
        Assign(TYPES, types);

        sanitise_data();
        Keys(answer).forEach(key => {
            expect(Y[key]).toEqual(answer[key]);
        });
    });
});

// save_option
[
    ['width', 100],
].forEach(([name, value], id) => {
    test(`save_option:${id}`, () => {
        save_option(name, value);
        expect(Y[name]).toEqual(value);
    });
});
