const svg_namespace = 'http://www.w3.org/2000/svg';
const horizontal_gap_between_leaves_in_pixels = 34;
const vertical_gap_between_levels_in_pixels = 54;
const drawing_margin_in_pixels = 18;
const leaf_radius_in_pixels = 13;
const branch_radius_in_pixels = 9;
const edge_label_sideways_offset_in_pixels = 7;
const rebuild_delay_after_typing_in_milliseconds = 120;
const slowest_step_duration_in_milliseconds = 480;
const visible_label_by_invisible_character = new Map([[' ', '␣'], ['\n', '↵'], ['\t', '⇥']]);

const page_elements = {
    input_text: document.getElementById('input_text'),
    tree_drawing: document.getElementById('tree_drawing'),
    play_button: document.getElementById('play_button'),
    speed_slider: document.getElementById('speed_slider'),
    encoded_bitstream: document.getElementById('encoded_bitstream'),
    code_table_body: document.getElementById('code_table_body'),
};

const page_state = {
    current_encoding: null,
    tree_elements_by_path: new Map(),
    bit_group_elements: [],
    playback_steps: [],
    playback_step_index: 0,
    is_playing: false,
    playback_timer_id: null,
    rebuild_timer_id: null,
};

function count_character_frequencies(text_characters) {
    const frequency_by_character = new Map();
    for (const character of text_characters) {
        frequency_by_character.set(character, (frequency_by_character.get(character) || 0) + 1);
    }
    return frequency_by_character;
}

function compare_nodes_by_frequency_then_creation_order(first_node, second_node) {
    const ordering = first_node.frequency - second_node.frequency || first_node.creation_order - second_node.creation_order;
    return ordering;
}

function create_leaf_node([character, frequency], creation_order) {
    const leaf_node = { character, frequency, creation_order, left: null, right: null };
    return leaf_node;
}

function build_huffman_tree(frequency_by_character) {
    const waiting_nodes = [...frequency_by_character].map(create_leaf_node);
    let next_creation_order = waiting_nodes.length;

    while (waiting_nodes.length > 1) {
        waiting_nodes.sort(compare_nodes_by_frequency_then_creation_order);
        const left = waiting_nodes.shift();
        const right = waiting_nodes.shift();
        waiting_nodes.push({ character: null, frequency: left.frequency + right.frequency, creation_order: next_creation_order++, left, right });
    }

    const root_node = waiting_nodes[0];
    return root_node;
}

function collect_leaf_paths(node, path_from_root) {
    if (!node.left) return [[node.character, path_from_root]];

    const leaf_paths = [...collect_leaf_paths(node.left, path_from_root + '0'), ...collect_leaf_paths(node.right, path_from_root + '1')];
    return leaf_paths;
}

function convert_leaf_path_into_code([character, path_from_root]) {
    const character_with_code = [character, path_from_root || '0'];
    return character_with_code;
}

function encode_text_with_huffman_tree(text) {
    const text_characters = [...text];
    const frequency_by_character = count_character_frequencies(text_characters);
    const root_node = build_huffman_tree(frequency_by_character);
    const leaf_paths = collect_leaf_paths(root_node, '');
    const leaf_path_by_character = new Map(leaf_paths);
    const code_by_character = new Map(leaf_paths.map(convert_leaf_path_into_code));
    const encoded_bit_count = text_characters.reduce((running_bit_count, character) => running_bit_count + code_by_character.get(character).length, 0);

    const encoding = { text_characters, frequency_by_character, root_node, leaf_path_by_character, code_by_character, encoded_bit_count };
    return encoding;
}

function place_subtree(node, depth, path_from_root, layout_accumulator) {
    if (!node.left) return place_leaf(node, depth, path_from_root, layout_accumulator);

    const left_x_in_pixels = place_subtree(node.left, depth + 1, path_from_root + '0', layout_accumulator);
    const right_x_in_pixels = place_subtree(node.right, depth + 1, path_from_root + '1', layout_accumulator);
    const x_in_pixels = (left_x_in_pixels + right_x_in_pixels) / 2;
    layout_accumulator.positioned_nodes.push({ node, depth, path_from_root, x_in_pixels });

    return x_in_pixels;
}

function place_leaf(node, depth, path_from_root, layout_accumulator) {
    const x_in_pixels = drawing_margin_in_pixels + leaf_radius_in_pixels + layout_accumulator.placed_leaf_count * horizontal_gap_between_leaves_in_pixels;
    layout_accumulator.placed_leaf_count += 1;
    layout_accumulator.deepest_level = Math.max(layout_accumulator.deepest_level, depth);
    layout_accumulator.positioned_nodes.push({ node, depth, path_from_root, x_in_pixels });

    return x_in_pixels;
}

function lay_out_tree(root_node) {
    const layout_accumulator = { positioned_nodes: [], placed_leaf_count: 0, deepest_level: 0 };
    place_subtree(root_node, 0, '', layout_accumulator);

    const tree_layout = {
        positioned_nodes: layout_accumulator.positioned_nodes,
        width_in_pixels: 2 * (drawing_margin_in_pixels + leaf_radius_in_pixels) + (layout_accumulator.placed_leaf_count - 1) * horizontal_gap_between_leaves_in_pixels,
        height_in_pixels: 2 * (drawing_margin_in_pixels + leaf_radius_in_pixels) + layout_accumulator.deepest_level * vertical_gap_between_levels_in_pixels,
    };
    return tree_layout;
}

function y_in_pixels_for_depth(depth) {
    const y_in_pixels = drawing_margin_in_pixels + leaf_radius_in_pixels + depth * vertical_gap_between_levels_in_pixels;
    return y_in_pixels;
}

function create_svg_element(tag_name, attributes, text_content) {
    const svg_element = document.createElementNS(svg_namespace, tag_name);
    for (const [attribute_name, attribute_value] of Object.entries(attributes)) svg_element.setAttribute(attribute_name, attribute_value);
    if (text_content !== undefined) svg_element.textContent = text_content;
    return svg_element;
}

function label_for_character(character) {
    const visible_label = visible_label_by_invisible_character.get(character) ?? character;
    return visible_label;
}

function draw_edge(child_position, parent_position) {
    const bit = child_position.path_from_root.at(-1);
    const child_y_in_pixels = y_in_pixels_for_depth(child_position.depth);
    const parent_y_in_pixels = y_in_pixels_for_depth(parent_position.depth);
    const label_x_in_pixels = (child_position.x_in_pixels + parent_position.x_in_pixels) / 2 + (bit === '0' ? -edge_label_sideways_offset_in_pixels : edge_label_sideways_offset_in_pixels);
    const label_y_in_pixels = (child_y_in_pixels + parent_y_in_pixels) / 2;

    const edge_group = create_svg_element('g', { class: 'tree_edge' });
    edge_group.append(
        create_svg_element('line', { x1: parent_position.x_in_pixels, y1: parent_y_in_pixels, x2: child_position.x_in_pixels, y2: child_y_in_pixels }),
        create_svg_element('text', { x: label_x_in_pixels, y: label_y_in_pixels }, bit),
    );
    return edge_group;
}

function draw_node(position, code_by_character) {
    const is_leaf = !position.node.left;
    const y_in_pixels = y_in_pixels_for_depth(position.depth);
    const label = is_leaf ? label_for_character(position.node.character) : position.node.frequency;

    const node_group = create_svg_element('g', { class: is_leaf ? 'tree_node is_leaf' : 'tree_node' });
    node_group.append(
        create_svg_element('circle', { cx: position.x_in_pixels, cy: y_in_pixels, r: is_leaf ? leaf_radius_in_pixels : branch_radius_in_pixels }),
        create_svg_element('text', { x: position.x_in_pixels, y: y_in_pixels }, label),
    );
    if (is_leaf) node_group.append(create_svg_element('title', {}, `${label} · ×${position.node.frequency} · ${code_by_character.get(position.node.character)}`));
    return node_group;
}

function render_tree(encoding) {
    const tree_layout = lay_out_tree(encoding.root_node);
    const position_by_path = new Map(tree_layout.positioned_nodes.map((position) => [position.path_from_root, position]));
    const tree_elements_by_path = new Map();
    const edge_layer = create_svg_element('g', {});
    const node_layer = create_svg_element('g', {});

    for (const position of tree_layout.positioned_nodes) {
        const node_element = draw_node(position, encoding.code_by_character);
        const edge_element = position.path_from_root ? draw_edge(position, position_by_path.get(position.path_from_root.slice(0, -1))) : null;
        node_layer.append(node_element);
        if (edge_element) edge_layer.append(edge_element);
        tree_elements_by_path.set(position.path_from_root, { node_element, edge_element });
    }

    const tree_drawing = page_elements.tree_drawing;
    tree_drawing.setAttribute('width', tree_layout.width_in_pixels);
    tree_drawing.setAttribute('height', tree_layout.height_in_pixels);
    tree_drawing.setAttribute('viewBox', `0 0 ${tree_layout.width_in_pixels} ${tree_layout.height_in_pixels}`);
    tree_drawing.replaceChildren(edge_layer, node_layer);

    return tree_elements_by_path;
}

function create_bit_group(character, character_index, code_by_character) {
    const bit_group = document.createElement('span');
    bit_group.className = 'bit_group';
    bit_group.dataset.characterIndex = character_index;
    bit_group.title = label_for_character(character);
    for (const bit of code_by_character.get(character)) {
        const bit_element = document.createElement('span');
        bit_element.textContent = bit;
        bit_group.append(bit_element);
    }
    return bit_group;
}

function render_bitstream(encoding) {
    const bit_group_elements = encoding.text_characters.map((character, character_index) => create_bit_group(character, character_index, encoding.code_by_character));
    page_elements.encoded_bitstream.replaceChildren(...bit_group_elements);
    return bit_group_elements;
}

function compare_table_rows_by_frequency_then_code_length(first_row, second_row) {
    const ordering = second_row.frequency - first_row.frequency || first_row.code.length - second_row.code.length || first_row.code.localeCompare(second_row.code);
    return ordering;
}

function create_code_table_row(table_row) {
    const row_element = document.createElement('tr');
    row_element.dataset.character = table_row.character;
    for (const cell_text of [label_for_character(table_row.character), table_row.frequency, table_row.code]) {
        const cell_element = document.createElement('td');
        cell_element.textContent = cell_text;
        row_element.append(cell_element);
    }
    return row_element;
}

function render_code_table(encoding) {
    const table_rows = [...encoding.code_by_character].map(([character, code]) => ({ character, code, frequency: encoding.frequency_by_character.get(character) }));
    const row_elements = table_rows.sort(compare_table_rows_by_frequency_then_code_length).map(create_code_table_row);
    page_elements.code_table_body.replaceChildren(...row_elements);
}

function clear_tree_highlight() {
    for (const lit_element of page_elements.tree_drawing.querySelectorAll('.is_lit')) lit_element.classList.remove('is_lit');
}

function highlight_tree_path(path_from_root) {
    clear_tree_highlight();
    for (let prefix_length = 0; prefix_length <= path_from_root.length; prefix_length += 1) {
        const tree_elements = page_state.tree_elements_by_path.get(path_from_root.slice(0, prefix_length));
        tree_elements.node_element.classList.add('is_lit');
        tree_elements.edge_element?.classList.add('is_lit');
    }
}

function clear_bitstream_highlight() {
    for (const highlighted_element of page_elements.encoded_bitstream.querySelectorAll('.is_current, .is_lit')) highlighted_element.classList.remove('is_current', 'is_lit');
}

function highlight_bit_group(character_index, revealed_bit_count) {
    clear_bitstream_highlight();
    const bit_group = page_state.bit_group_elements[character_index];
    bit_group.classList.add('is_current');
    [...bit_group.children].slice(0, revealed_bit_count).forEach((bit_element) => bit_element.classList.add('is_lit'));
}

function build_playback_steps(encoding) {
    const playback_steps = encoding.text_characters.flatMap((character, character_index) => build_steps_for_one_character(character, character_index, encoding));
    return playback_steps;
}

function build_steps_for_one_character(character, character_index, encoding) {
    const code = encoding.code_by_character.get(character);
    const steps_for_character = Array.from({ length: code.length + 1 }, (_, revealed_bit_count) => ({ character, character_index, revealed_bit_count, code }));
    return steps_for_character;
}

function show_playback_step(playback_step) {
    const leaf_path = page_state.current_encoding.leaf_path_by_character.get(playback_step.character);
    highlight_tree_path(leaf_path.slice(0, playback_step.revealed_bit_count));
    highlight_bit_group(playback_step.character_index, playback_step.revealed_bit_count);
}

function step_duration_in_milliseconds() {
    const step_duration = slowest_step_duration_in_milliseconds / Number(page_elements.speed_slider.value);
    return step_duration;
}

function advance_playback() {
    if (!page_state.is_playing) return;

    show_playback_step(page_state.playback_steps[page_state.playback_step_index]);
    page_state.playback_step_index = (page_state.playback_step_index + 1) % page_state.playback_steps.length;
    page_state.playback_timer_id = setTimeout(advance_playback, step_duration_in_milliseconds());
}

function start_playback() {
    if (!page_state.playback_steps.length) return;

    page_state.is_playing = true;
    page_elements.play_button.textContent = 'Stop';
    advance_playback();
}

function stop_playback() {
    page_state.is_playing = false;
    clearTimeout(page_state.playback_timer_id);
    page_elements.play_button.textContent = 'Play';
    clear_tree_highlight();
    clear_bitstream_highlight();
}

function clear_rendered_encoding() {
    page_state.current_encoding = null;
    page_state.tree_elements_by_path = new Map();
    page_state.bit_group_elements = [];
    page_state.playback_steps = [];
    page_elements.tree_drawing.replaceChildren();
    page_elements.tree_drawing.setAttribute('height', 0);
    page_elements.encoded_bitstream.replaceChildren();
    page_elements.code_table_body.replaceChildren();
}

function rebuild_from_input_text() {
    stop_playback();
    const text = page_elements.input_text.value;
    if (!text) return clear_rendered_encoding();

    const encoding = encode_text_with_huffman_tree(text);
    page_state.current_encoding = encoding;
    page_state.tree_elements_by_path = render_tree(encoding);
    page_state.bit_group_elements = render_bitstream(encoding);
    page_state.playback_steps = build_playback_steps(encoding);
    page_state.playback_step_index = 0;
    render_code_table(encoding);
}

function schedule_rebuild_from_input_text() {
    clearTimeout(page_state.rebuild_timer_id);
    page_state.rebuild_timer_id = setTimeout(rebuild_from_input_text, rebuild_delay_after_typing_in_milliseconds);
}

function toggle_playback() {
    if (page_state.is_playing) return stop_playback();
    start_playback();
}

function preview_character_under_pointer(pointer_event) {
    if (page_state.is_playing || !page_state.current_encoding) return;

    const table_row = pointer_event.target.closest('tr[data-character]');
    const bit_group = pointer_event.target.closest('.bit_group');
    const hovered_character = table_row?.dataset.character ?? page_state.current_encoding.text_characters[bit_group?.dataset.characterIndex];
    if (hovered_character === undefined) return clear_tree_highlight();

    highlight_tree_path(page_state.current_encoding.leaf_path_by_character.get(hovered_character));
}

function clear_preview() {
    if (!page_state.is_playing) clear_tree_highlight();
}

page_elements.input_text.addEventListener('input', schedule_rebuild_from_input_text);
page_elements.play_button.addEventListener('click', toggle_playback);
for (const hover_source of [page_elements.code_table_body, page_elements.encoded_bitstream]) {
    hover_source.addEventListener('pointerover', preview_character_under_pointer);
    hover_source.addEventListener('pointerleave', clear_preview);
}

rebuild_from_input_text();
