#!/usr/bin/env node
// Comprehensive test suite for generators.js (runs in Node.js via shim)

// ── Shim browser globals so generators.js loads ───────────────────────────
Math.seedRandom = null; // just in case

// Load generator functions inline (copy-paste-free: eval the file)
const fs = require('fs');
const path = require('path');
eval(fs.readFileSync(path.join(__dirname, '../js/generators.js'), 'utf8'));

// ── Minimal test framework ─────────────────────────────────────────────────
let passed = 0, failed = 0, total = 0;

function assert(condition, label) {
  total++;
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label}`);
    failed++;
  }
}

function assertEq(a, b, label) {
  assert(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
}

function assertDeepKey(obj, keyPath, label) {
  // Split path on '.' but NOT when the dot is inside a minecraft:xxx.yyy key.
  // Strategy: split only on '.' that are NOT preceded by a colon-containing segment.
  // Simpler: use a pre-defined list of known compound keys, or just walk manually.
  // We split on the FIRST dot that is followed by 'minecraft:' or a section separator.
  // Actually: split on '.' only between top-level JSON key segments.
  // Use a safe split that doesn't break keys containing dots:
  const parts = [];
  let remaining = keyPath;
  // Known compound key prefixes to handle (they contain dots themselves):
  const compoundPrefixes = [
    'minecraft:behavior.',
    'minecraft:navigation.',
    'minecraft:movement.',
    'minecraft:destructible_by_',
  ];
  while (remaining.length > 0) {
    // Try to find the next '.'-separated segment
    const dotIdx = remaining.indexOf('.');
    if (dotIdx === -1) {
      parts.push(remaining);
      break;
    }
    const candidate = remaining.slice(0, dotIdx);
    // Check if candidate + '.' is the start of a compound key
    const isCompound = compoundPrefixes.some(p => remaining.startsWith(p));
    if (isCompound) {
      // Find the end of the compound key (next '.' that ends the key)
      // Compound keys end at the next '.' that separates JSON levels
      // Heuristic: take up to second dot for minecraft:xxx.yyy
      const secondDot = remaining.indexOf('.', dotIdx + 1);
      if (secondDot === -1) {
        parts.push(remaining);
        break;
      }
      parts.push(remaining.slice(0, secondDot));
      remaining = remaining.slice(secondDot + 1);
    } else {
      parts.push(candidate);
      remaining = remaining.slice(dotIdx + 1);
    }
  }

  let cur = obj;
  for (const k of parts) {
    if (cur === undefined || cur === null || !(k in cur)) {
      assert(false, `${label} — missing key "${k}" in path "${keyPath}"`);
      return;
    }
    cur = cur[k];
  }
  assert(true, label);
}

function section(name) {
  console.log(`\n── ${name} ──`);
}

// ── resolveId ──────────────────────────────────────────────────────────────
section('resolveId');
assertEq(resolveId('foo:bar', 'ns'), 'foo:bar', 'preserves explicit namespace');
assertEq(resolveId('bar', 'ns'), 'ns:bar', 'prepends namespace when missing');
assertEq(resolveId('minecraft:stone', 'ns'), 'minecraft:stone', 'preserves minecraft namespace');

// ── genUUID ────────────────────────────────────────────────────────────────
section('genUUID');
const uuid = genUUID();
assert(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(uuid),
  'UUID format is valid RFC 4122 v4');
assert(genUUID() !== genUUID(), 'UUIDs are unique');

// ── generateManifestBP ─────────────────────────────────────────────────────
section('generateManifestBP');
const project = { name: 'Test Addon', description: 'Test', namespace: 'test', version: [1,2,3] };
const bpManifest = generateManifestBP(project);
assertEq(bpManifest.format_version, 2, 'format_version is 2');
assert(bpManifest.header.name.includes('Test Addon'), 'header.name includes project name');
assert(bpManifest.header.name.includes('Behavior Pack'), 'header.name includes "Behavior Pack"');
assertEq(bpManifest.header.min_engine_version, [1,20,0], 'min_engine_version is [1,20,0]');
assertEq(bpManifest.modules[0].type, 'data', 'module type is data');
assert(/^[0-9a-f-]{36}$/.test(bpManifest.header.uuid), 'header.uuid is valid UUID');
assert(/^[0-9a-f-]{36}$/.test(bpManifest.modules[0].uuid), 'module.uuid is valid UUID');
assert(bpManifest.header.uuid !== bpManifest.modules[0].uuid, 'header and module UUIDs differ');

// ── generateManifestRP ─────────────────────────────────────────────────────
section('generateManifestRP');
const rpManifest = generateManifestRP(project);
assertEq(rpManifest.modules[0].type, 'resources', 'RP module type is resources');
assert(rpManifest.header.name.includes('Resource Pack'), 'RP header name includes "Resource Pack"');
assertEq(rpManifest.format_version, 2, 'format_version is 2');

// ── generateItemBP ─────────────────────────────────────────────────────────
section('generateItemBP — basic item');
const basicItem = {
  identifier: 'test:my_item',
  displayName: 'My Item',
  category: 'Items',
  maxStackSize: 64,
  isWeapon: false, isFood: false, isFoil: false, isThrowable: false, handEquipped: false
};
const itemJson = generateItemBP(basicItem, 'test');
assertEq(itemJson.format_version, '1.20.10', 'item format_version 1.20.10');
assertEq(itemJson['minecraft:item'].description.identifier, 'test:my_item', 'item identifier');
assertDeepKey(itemJson, 'minecraft:item.components.minecraft:max_stack_size', 'has max_stack_size');
assertEq(itemJson['minecraft:item'].components['minecraft:max_stack_size'], 64, 'max_stack_size=64');
assertDeepKey(itemJson, 'minecraft:item.components.minecraft:icon', 'has icon component');
assertEq(itemJson['minecraft:item'].components['minecraft:icon'].texture, 'test_my_item', 'icon texture name uses underscore not colon');

section('generateItemBP — weapon');
const weaponItem = { ...basicItem, identifier: 'test:sword', isWeapon: true, damage: 7, durability: 250 };
const weaponJson = generateItemBP(weaponItem, 'test');
assertEq(weaponJson['minecraft:item'].components['minecraft:damage'], 7, 'weapon damage');
assertEq(weaponJson['minecraft:item'].components['minecraft:durability'].max_durability, 250, 'weapon durability');

section('generateItemBP — weapon with 0 damage (no damage component)');
const weaponZero = { ...basicItem, identifier: 'test:sword2', isWeapon: true, damage: 0, durability: 0 };
const weaponZeroJson = generateItemBP(weaponZero, 'test');
assert(!('minecraft:damage' in weaponZeroJson['minecraft:item'].components), 'no damage component when damage=0');
assert(!('minecraft:durability' in weaponZeroJson['minecraft:item'].components), 'no durability component when durability=0');

section('generateItemBP — food');
const foodItem = { ...basicItem, identifier: 'test:bread', isFood: true, nutrition: 5, saturationModifier: 'normal', canAlwaysEat: false };
const foodJson = generateItemBP(foodItem, 'test');
assertDeepKey(foodJson, 'minecraft:item.components.minecraft:food', 'has food component');
assertEq(foodJson['minecraft:item'].components['minecraft:food'].nutrition, 5, 'food nutrition');

section('generateItemBP — food canAlwaysEat');
const alwaysEatItem = { ...foodItem, canAlwaysEat: true };
const alwaysEatJson = generateItemBP(alwaysEatItem, 'test');
assertEq(alwaysEatJson['minecraft:item'].components['minecraft:food'].can_always_eat, true, 'can_always_eat flag');

section('generateItemBP — throwable');
const throwItem = { ...basicItem, identifier: 'test:ball', isThrowable: true };
const throwJson = generateItemBP(throwItem, 'test');
assertDeepKey(throwJson, 'minecraft:item.components.minecraft:throwable', 'has throwable');
assertDeepKey(throwJson, 'minecraft:item.components.minecraft:projectile', 'has projectile');

section('generateItemBP — max stack size clamped');
const bigStack = { ...basicItem, identifier: 'test:big', maxStackSize: 999 };
const bigJson = generateItemBP(bigStack, 'test');
assertEq(bigJson['minecraft:item'].components['minecraft:max_stack_size'], 64, 'stack size clamped to 64');

const zeroStack = { ...basicItem, identifier: 'test:zero', maxStackSize: 0 };
const zeroJson = generateItemBP(zeroStack, 'test');
assertEq(zeroJson['minecraft:item'].components['minecraft:max_stack_size'], 1, 'stack size min 1');

section('generateItemBP — namespace inferred');
const noNsItem = { ...basicItem, identifier: 'nameless_item' };
const noNsJson = generateItemBP(noNsItem, 'mymod');
assertEq(noNsJson['minecraft:item'].description.identifier, 'mymod:nameless_item', 'namespace prepended');

// ── generateBlockBP ────────────────────────────────────────────────────────
section('generateBlockBP — basic');
const basicBlock = {
  identifier: 'test:my_block',
  category: 'Construction',
  hardness: 2.0,
  resistance: 6.0,
  friction: 0.6,
  isFlammable: false,
  mapColor: '#884400',
  lightEmission: 0,
  lightDampening: 15,
  isTransparent: false
};
const blockJson = generateBlockBP(basicBlock, 'test');
assertEq(blockJson.format_version, '1.20.10', 'block format_version');
assertEq(blockJson['minecraft:block'].description.identifier, 'test:my_block', 'block identifier');
assertDeepKey(blockJson, 'minecraft:block.components.minecraft:destructible_by_mining', 'has destructible_by_mining');
assertEq(blockJson['minecraft:block'].components['minecraft:destructible_by_mining'].seconds_to_destroy, 2.0, 'hardness 2.0');
assertDeepKey(blockJson, 'minecraft:block.components.minecraft:geometry', 'has geometry');
assertEq(blockJson['minecraft:block'].components['minecraft:geometry'], 'minecraft:geometry.full_block', 'geometry is full_block');
assertDeepKey(blockJson, 'minecraft:block.components.minecraft:material_instances', 'has material_instances');
assertEq(blockJson['minecraft:block'].components['minecraft:material_instances']['*'].render_method, 'opaque', 'opaque block render method');

section('generateBlockBP — transparent');
const transBlock = { ...basicBlock, identifier: 'test:glass', isTransparent: true };
const transJson = generateBlockBP(transBlock, 'test');
assertEq(transJson['minecraft:block'].components['minecraft:material_instances']['*'].render_method, 'blend', 'transparent render method is blend');

section('generateBlockBP — flammable');
const flamBlock = { ...basicBlock, identifier: 'test:wood', isFlammable: true, flamOdds: 5, burnOdds: 20 };
const flamJson = generateBlockBP(flamBlock, 'test');
assertDeepKey(flamJson, 'minecraft:block.components.minecraft:flammable', 'has flammable component');
assertEq(flamJson['minecraft:block'].components['minecraft:flammable'].catch_chance_modifier, 5, 'catch_chance_modifier');

section('generateBlockBP — indestructible (hardness -1)');
const indeBlock = { ...basicBlock, identifier: 'test:bedrock', hardness: -1 };
const indeJson = generateBlockBP(indeBlock, 'test');
assertEq(indeJson['minecraft:block'].components['minecraft:destructible_by_mining'], false, 'hardness -1 = indestructible (false)');

section('generateBlockBP — light emitting');
const glowBlock = { ...basicBlock, identifier: 'test:lantern', lightEmission: 15 };
const glowJson = generateBlockBP(glowBlock, 'test');
assertEq(glowJson['minecraft:block'].components['minecraft:light_emission'], 15, 'light_emission component');

// ── generateEntityBP ────────────────────────────────────────────────────────
section('generateEntityBP — passive entity');
const passiveEntity = {
  identifier: 'test:my_cow',
  health: 20,
  movementSpeed: 0.25,
  collisionWidth: 0.9,
  collisionHeight: 1.4,
  isHostile: false,
  isTameable: false,
  isSpawnable: true,
  dropsXP: 0,
  knockbackResist: 0,
  swimsInWater: false
};
const passiveJson = generateEntityBP(passiveEntity, 'test');
assertEq(passiveJson.format_version, '1.20.10', 'entity format_version 1.20.10');
assertEq(passiveJson['minecraft:entity'].description.identifier, 'test:my_cow', 'entity identifier');
assertEq(passiveJson['minecraft:entity'].description.is_spawnable, true, 'is_spawnable true');
assertEq(passiveJson['minecraft:entity'].description.is_summonable, true, 'is_summonable true');
assertDeepKey(passiveJson, 'minecraft:entity.components.minecraft:health', 'has health');
assertEq(passiveJson['minecraft:entity'].components['minecraft:health'].max, 20, 'health max=20');
assert(!('minecraft:attack' in passiveJson['minecraft:entity'].components), 'passive: no attack component');
assert(!('minecraft:behavior.melee_attack' in passiveJson['minecraft:entity'].components), 'passive: no melee_attack behavior');

section('generateEntityBP — hostile entity');
const hostileEntity = { ...passiveEntity, identifier: 'test:my_zombie', isHostile: true, attackDamage: 5, dropsXP: 5 };
const hostileJson = generateEntityBP(hostileEntity, 'test');
assertDeepKey(hostileJson, 'minecraft:entity.components.minecraft:attack', 'hostile: has attack');
assertEq(hostileJson['minecraft:entity'].components['minecraft:attack'].damage, 5, 'hostile: attack damage');
assertDeepKey(hostileJson, 'minecraft:entity.components.minecraft:behavior.melee_attack', 'hostile: has melee_attack');
assertDeepKey(hostileJson, 'minecraft:entity.components.minecraft:behavior.nearest_attackable_target', 'hostile: has nearest_attackable_target');
assertDeepKey(hostileJson, 'minecraft:entity.components.minecraft:experience_reward', 'hostile: has xp reward when dropsXP>0');

section('generateEntityBP — tameable entity');
const tameEntity = { ...passiveEntity, identifier: 'test:my_wolf', isTameable: true };
const tameJson = generateEntityBP(tameEntity, 'test');
assertDeepKey(tameJson, 'minecraft:entity.components.minecraft:tameable', 'tameable: has tameable component');
assertDeepKey(tameJson, 'minecraft:entity.components.minecraft:behavior.follow_owner', 'tameable: has follow_owner behavior');

section('generateEntityBP — knockback resistance');
const kbEntity = { ...passiveEntity, identifier: 'test:tank', knockbackResist: 0.5 };
const kbJson = generateEntityBP(kbEntity, 'test');
assertDeepKey(kbJson, 'minecraft:entity.components.minecraft:knockback_resistance', 'has knockback_resistance');
assertEq(kbJson['minecraft:entity'].components['minecraft:knockback_resistance'].value, 0.5, 'knockback_resistance value=0.5');

section('generateEntityBP — water navigation');
const swimEntity = { ...passiveEntity, identifier: 'test:swimmer', swimsInWater: true };
const swimJson = generateEntityBP(swimEntity, 'test');
assertEq(swimJson['minecraft:entity'].components['minecraft:navigation.walk'].avoid_water, false, 'swimmer does not avoid water');
assertDeepKey(swimJson, 'minecraft:entity.components.minecraft:underwater_movement', 'swimmer has underwater_movement component');
assertDeepKey(swimJson, 'minecraft:entity.components.minecraft:navigation.swim', 'swimmer has swim navigation');
assertEq(swimJson['minecraft:entity'].components['minecraft:breathable'].breathes_water, true, 'swimmer breathes water');

section('generateEntityBP — non-swimmer has breathable (air only)');
const airOnlyJson = generateEntityBP(passiveEntity, 'test');
assertEq(airOnlyJson['minecraft:entity'].components['minecraft:breathable'].breathes_water, false, 'non-swimmer does not breathe water');
assert(!('minecraft:underwater_movement' in airOnlyJson['minecraft:entity'].components), 'non-swimmer has no underwater_movement');

// ── generateEntityGeometry ─────────────────────────────────────────────────
section('generateEntityGeometry — humanoid');
const humanEntity = { identifier: 'test:humanoid', bodyType: 'humanoid' };
const humanGeo = generateEntityGeometry(humanEntity, 'test');
assertEq(humanGeo.format_version, '1.12.0', 'geometry format_version 1.12.0');
assertDeepKey(humanGeo, 'minecraft:geometry', 'has minecraft:geometry array');
assertEq(humanGeo['minecraft:geometry'][0].description.identifier, 'geometry.test_humanoid', 'geometry identifier uses underscore');
assertEq(humanGeo['minecraft:geometry'][0].description.texture_width, 64, 'humanoid texture width 64');
assertEq(humanGeo['minecraft:geometry'][0].description.texture_height, 64, 'humanoid texture height 64');
const humanBoneNames = humanGeo['minecraft:geometry'][0].bones.map(b => b.name);
assert(humanBoneNames.includes('head'), 'humanoid has head bone');
assert(humanBoneNames.includes('body'), 'humanoid has body bone');
assert(humanBoneNames.includes('rightArm'), 'humanoid has rightArm bone');
assert(humanBoneNames.includes('leftArm'), 'humanoid has leftArm bone');
assert(humanBoneNames.includes('rightLeg'), 'humanoid has rightLeg bone');
assert(humanBoneNames.includes('leftLeg'), 'humanoid has leftLeg bone');

section('generateEntityGeometry — quadruped');
const quadEntity = { identifier: 'test:pig', bodyType: 'quadruped' };
const quadGeo = generateEntityGeometry(quadEntity, 'test');
assertEq(quadGeo['minecraft:geometry'][0].description.texture_height, 32, 'quadruped texture height 32');
const quadBoneNames = quadGeo['minecraft:geometry'][0].bones.map(b => b.name);
assert(quadBoneNames.includes('head'), 'quadruped has head');
assert(quadBoneNames.filter(n => n.startsWith('leg')).length === 4, 'quadruped has 4 legs');

section('generateEntityGeometry — bird');
const birdEntity = { identifier: 'test:bird', bodyType: 'bird' };
const birdGeo = generateEntityGeometry(birdEntity, 'test');
assertEq(birdGeo['minecraft:geometry'][0].description.texture_height, 32, 'bird texture height 32');
const birdBones = birdGeo['minecraft:geometry'][0].bones.map(b => b.name);
assert(birdBones.includes('beak'), 'bird has beak bone');
assert(birdBones.includes('wing0'), 'bird has wing0');
assert(birdBones.includes('wing1'), 'bird has wing1');

section('generateEntityGeometry — slime');
const slimeEntity = { identifier: 'test:slime', bodyType: 'slime' };
const slimeGeo = generateEntityGeometry(slimeEntity, 'test');
assertEq(slimeGeo['minecraft:geometry'][0].description.texture_height, 32, 'slime texture height 32');
const slimeBones = slimeGeo['minecraft:geometry'][0].bones.map(b => b.name);
assert(slimeBones.includes('body'), 'slime has body');
assert(slimeBones.includes('eyes'), 'slime has eyes');

section('generateEntityGeometry — undead (same layout as humanoid)');
const undeadEntity = { identifier: 'test:zombie', bodyType: 'undead' };
const undeadGeo = generateEntityGeometry(undeadEntity, 'test');
assertEq(undeadGeo['minecraft:geometry'][0].description.texture_height, 64, 'undead texture height 64 (same as humanoid)');

section('generateEntityGeometry — default (unknown bodyType)');
const unknownEntity = { identifier: 'test:weird', bodyType: 'dragon' };
const unknownGeo = generateEntityGeometry(unknownEntity, 'test');
assertEq(unknownGeo['minecraft:geometry'][0].description.texture_height, 64, 'unknown bodyType defaults to humanoid (64h)');

// ── generateEntityClientEntity ─────────────────────────────────────────────
section('generateEntityClientEntity');
const clientEntity = { identifier: 'test:my_mob', bodyType: 'humanoid', color: '#ff0000', color2: '#880000' };
const clientJson = generateEntityClientEntity(clientEntity, 'test');
assertEq(clientJson.format_version, '1.10.0', 'client entity format_version 1.10.0');
assertDeepKey(clientJson, 'minecraft:client_entity.description.identifier', 'has identifier');
assertEq(clientJson['minecraft:client_entity'].description.identifier, 'test:my_mob', 'client entity identifier');
assertEq(clientJson['minecraft:client_entity'].description.geometry.default, 'geometry.test_my_mob', 'geometry ID uses underscore');
assertEq(clientJson['minecraft:client_entity'].description.textures.default, 'textures/entity/test_my_mob', 'texture path correct');
assertDeepKey(clientJson, 'minecraft:client_entity.description.spawn_egg', 'has spawn_egg');
assertEq(clientJson['minecraft:client_entity'].description.spawn_egg.base_color, '#ff0000', 'spawn egg base color');

// ── generateRecipeBP — shaped ──────────────────────────────────────────────
section('generateRecipeBP — shaped');
const shapedRecipe = {
  identifier: 'test:diamond_sword_recipe',
  type: 'shaped',
  result: 'minecraft:diamond_sword',
  resultCount: 1,
  pattern: [
    ['minecraft:diamond', '', ''],
    ['minecraft:diamond', '', ''],
    ['', 'minecraft:stick', '']
  ]
};
const shapedJson = generateRecipeBP(shapedRecipe, 'test');
assertEq(shapedJson.format_version, '1.17.41', 'recipe format_version 1.17.41');
assertDeepKey(shapedJson, 'minecraft:recipe_shaped', 'shaped recipe key exists');
assert(Array.isArray(shapedJson['minecraft:recipe_shaped'].pattern), 'pattern is array');
assertDeepKey(shapedJson, 'minecraft:recipe_shaped.key', 'key mapping exists');
assertEq(shapedJson['minecraft:recipe_shaped'].result.item, 'minecraft:diamond_sword', 'result item');
// Trailing empty rows should be trimmed
const pat = shapedJson['minecraft:recipe_shaped'].pattern;
assert(pat.length <= 3, 'pattern not longer than 3 rows');
// Verify key maps correctly
const keyVals = Object.values(shapedJson['minecraft:recipe_shaped'].key).map(v => v.item);
assert(keyVals.includes('minecraft:diamond'), 'key includes diamond');
assert(keyVals.includes('minecraft:stick'), 'key includes stick');

section('generateRecipeBP — empty pattern trims to single space');
const emptyRecipe = {
  identifier: 'test:empty_recipe',
  type: 'shaped',
  result: 'minecraft:air',
  resultCount: 1,
  pattern: [['','',''],['','',''],['','','']]
};
const emptyJson = generateRecipeBP(emptyRecipe, 'test');
assertEq(emptyJson['minecraft:recipe_shaped'].pattern, [' '], 'empty pattern trims to [" "]');

section('generateRecipeBP — shapeless');
const shapelessRecipe = {
  identifier: 'test:fire_charge',
  type: 'shapeless',
  result: 'minecraft:fire_charge',
  resultCount: 3,
  ingredients: ['minecraft:blaze_powder', 'minecraft:coal', 'minecraft:gunpowder']
};
const shapelessJson = generateRecipeBP(shapelessRecipe, 'test');
assertDeepKey(shapelessJson, 'minecraft:recipe_shapeless', 'shapeless recipe key exists');
assertEq(shapelessJson['minecraft:recipe_shapeless'].ingredients.length, 3, 'shapeless has 3 ingredients');
assertEq(shapelessJson['minecraft:recipe_shapeless'].result.count, 3, 'shapeless result count=3');

section('generateRecipeBP — smelting');
const smeltRecipe = {
  identifier: 'test:smelt_ore',
  type: 'smelting',
  result: 'minecraft:iron_ingot',
  input: 'minecraft:iron_ore',
  smeltingType: 'furnace'
};
const smeltJson = generateRecipeBP(smeltRecipe, 'test');
assertDeepKey(smeltJson, 'minecraft:recipe_furnace', 'furnace recipe key exists');
assertEq(smeltJson['minecraft:recipe_furnace'].tags[0], 'furnace', 'furnace tag');
assertEq(smeltJson['minecraft:recipe_furnace'].input.item, 'minecraft:iron_ore', 'input item');
assertEq(smeltJson['minecraft:recipe_furnace'].output, 'minecraft:iron_ingot', 'output item');

section('generateRecipeBP — shapeless with empty ingredients filtered out');
const sparseIngredients = {
  identifier: 'test:sparse',
  type: 'shapeless',
  result: 'minecraft:dirt',
  resultCount: 1,
  ingredients: ['minecraft:sand', '', '  ', 'minecraft:gravel']
};
const sparseJson = generateRecipeBP(sparseIngredients, 'test');
assertEq(sparseJson['minecraft:recipe_shapeless'].ingredients.length, 2, 'empty ingredients filtered out');

section('generateRecipeBP — unknown type returns null');
const badRecipe = { identifier: 'test:bad', type: 'magic' };
assert(generateRecipeBP(badRecipe, 'test') === null, 'unknown recipe type returns null');

// ── generateTerrainTexture ─────────────────────────────────────────────────
section('generateTerrainTexture');
const blocks = [{ identifier: 'test:brick' }, { identifier: 'stone' }];
const terrain = generateTerrainTexture(blocks, 'test', 'MyAddon');
assertEq(terrain.resource_pack_name, 'MyAddon', 'terrain resource_pack_name uses provided name');
assertEq(terrain.texture_name, 'atlas.terrain', 'terrain texture_name');
assert('test_brick' in terrain.texture_data, 'test_brick in texture_data');
assert('test_stone' in terrain.texture_data, 'test_stone (namespaced) in texture_data');
assertEq(terrain.texture_data['test_brick'].textures, 'textures/blocks/test_brick', 'texture path correct');

section('generateTerrainTexture — fallback pack name');
const terrainFallback = generateTerrainTexture(blocks, 'test');
assertEq(terrainFallback.resource_pack_name, 'vanilla', 'falls back to "vanilla" when no pack name given');

// ── generateItemTexture ────────────────────────────────────────────────────
section('generateItemTexture');
const items = [{ identifier: 'test:my_gem' }];
const itemTex = generateItemTexture(items, 'test', 'MyAddon');
assertEq(itemTex.resource_pack_name, 'MyAddon', 'item texture resource_pack_name');
assertEq(itemTex.texture_name, 'atlas.items', 'item texture_name');
assert('test_my_gem' in itemTex.texture_data, 'my_gem in texture_data');
assertEq(itemTex.texture_data['test_my_gem'].textures, 'textures/items/test_my_gem', 'item texture path');

// ── generateLangFile ───────────────────────────────────────────────────────
section('generateLangFile');
const langItems = [{ identifier: 'test:bread', displayName: 'Crusty Bread' }];
const langBlocks = [{ identifier: 'test:brick', displayName: 'Red Brick' }];
const langEntities = [{ identifier: 'test:goblin', displayName: 'Goblin' }];
const lang = generateLangFile(langItems, langBlocks, langEntities, 'test');
assert(lang.includes('item.test:bread.name=Crusty Bread'), 'item lang key correct');
assert(lang.includes('tile.test:brick.name=Red Brick'), 'block lang key uses "tile."');
assert(lang.includes('entity.test:goblin.name=Goblin'), 'entity lang key correct');

section('generateLangFile — falls back to slug for display name');
const noNameItems = [{ identifier: 'test:unnamed' }];
const noNameLang = generateLangFile(noNameItems, [], [], 'test');
assert(noNameLang.includes('item.test:unnamed.name=unnamed'), 'falls back to identifier slug (after :) for display name');

// ── generateItemRP ─────────────────────────────────────────────────────────
section('generateItemRP');
const rpItem = { identifier: 'test:my_item', category: 'Equipment' };
const rpItemJson = generateItemRP(rpItem, 'test');
assertEq(rpItemJson.format_version, '1.10.0', 'item RP format_version');
assertDeepKey(rpItemJson, 'minecraft:item.description.identifier', 'has identifier');
assertEq(rpItemJson['minecraft:item'].description.category, 'Equipment', 'category mapped correctly');
assertDeepKey(rpItemJson, 'minecraft:item.components.minecraft:icon', 'has icon component');

// ── syntaxHighlight ────────────────────────────────────────────────────────
section('syntaxHighlight');
const highlighted = syntaxHighlight({ key: 'value', num: 42, flag: true });
assert(highlighted.includes('json-key'), 'highlights keys');
assert(highlighted.includes('json-str'), 'highlights strings');
assert(highlighted.includes('json-num'), 'highlights numbers');
assert(highlighted.includes('json-bool'), 'highlights booleans');
assert(!highlighted.includes('<script'), 'no XSS via <script');
const xssTest = syntaxHighlight({ evil: '<script>alert(1)</script>' });
assert(xssTest.includes('&lt;script&gt;'), 'HTML escapes < and >');

// ── Edge cases & boundary conditions ──────────────────────────────────────
section('Edge Cases');

// Item with glint
const glintItem = { ...basicItem, identifier: 'test:enchanted', isFoil: true };
const glintJson = generateItemBP(glintItem, 'test');
assertEq(glintJson['minecraft:item'].components['minecraft:glint'], true, 'glint/foil component added');

// Item with hand_equipped
const handItem = { ...basicItem, identifier: 'test:hand', handEquipped: true };
const handJson = generateItemBP(handItem, 'test');
assertEq(handJson['minecraft:item'].components['minecraft:hand_equipped'], true, 'hand_equipped component');

// Entity with no XP doesn't get experience_reward
const noXpEntity = { ...passiveEntity, identifier: 'test:no_xp', dropsXP: 0 };
const noXpJson = generateEntityBP(noXpEntity, 'test');
assert(!('minecraft:experience_reward' in noXpJson['minecraft:entity'].components), 'no xp reward when dropsXP=0');

// Entity with no knockback resist doesn't get knockback_resistance
const noKbEntity = { ...passiveEntity, identifier: 'test:no_kb', knockbackResist: 0 };
const noKbJson = generateEntityBP(noKbEntity, 'test');
assert(!('minecraft:knockback_resistance' in noKbJson['minecraft:entity'].components), 'no knockback_resistance when value=0');

// Block with NaN lightDampening doesn't get the component
const noDampBlock = { ...basicBlock, identifier: 'test:no_damp', lightDampening: NaN };
const noDampJson = generateBlockBP(noDampBlock, 'test');
assert(!('minecraft:light_dampening' in noDampJson['minecraft:block'].components), 'NaN lightDampening omitted');

// Entity geometry has all bones with required fields
section('Geometry bone structure validation');
for (const bodyType of ['humanoid', 'undead', 'quadruped', 'bird', 'slime', 'bat']) {
  const geo = generateEntityGeometry({ identifier: `test:${bodyType}`, bodyType }, 'test');
  const bones = geo['minecraft:geometry'][0].bones;
  const hasRoot = bones.some(b => b.name === 'root');
  assert(hasRoot, `${bodyType}: has root bone`);
  const allHaveName = bones.every(b => typeof b.name === 'string' && b.name.length > 0);
  assert(allHaveName, `${bodyType}: all bones have names`);
  const allWithCubesHaveArrays = bones.filter(b => b.cubes).every(b => Array.isArray(b.cubes));
  assert(allWithCubesHaveArrays, `${bodyType}: all cube definitions are arrays`);
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(55)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${total} total`);
if (failed > 0) {
  console.error(`\n${failed} test(s) FAILED`);
  process.exit(1);
} else {
  console.log('\nAll tests passed!');
}
