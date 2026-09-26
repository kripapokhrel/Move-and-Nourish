// The exercise library the generator picks from. Add exercises here; nothing else needs to change.
//
// pattern: the slot an exercise can fill in a workout (see generator.ts)
// needs:   equipment required. "none" = bodyweight, "gym" = machines/barbells/cables
// level:   lowest fitness level it suits. 0 beginner, 1 intermediate, 2 advanced
// tips:    step-by-step how-to, shown under the exercise
// timed:   done for time ("30 sec") instead of reps
// perSide: reps or time are per leg, arm or side
// knee:    strengthens the outer hip or hamstrings, which helps keep knees stable (used for women's lower-body days)
// woman:   the photos show a woman. Almost all free-exercise-db photos show men (checked all 876 on 2026-09-26);
//          these few are slightly preferred for women users
// image:   folder name in free-exercise-db (public domain). The UI shows its start (0.jpg) and finish (1.jpg) photos.
//          Every exercise must have one, so users can always see how it should look. No photo, no exercise.

export type Pattern =
  | "warmup" | "cooldown" | "squat" | "hinge" | "lunge" | "legs_accessory"
  | "push_horizontal" | "push_vertical" | "pull_horizontal" | "pull_vertical"
  | "shoulders" | "biceps" | "triceps" | "core" | "cardio";

export type Gear = "none" | "dumbbells" | "bands" | "gym";

export type LibraryExercise = {
  name: string;
  pattern: Pattern;
  muscle: string;
  needs: Gear;
  level: 0 | 1 | 2;
  tips: string[];
  timed?: boolean;
  perSide?: "leg" | "arm" | "side";
  knee?: boolean;
  woman?: boolean;
  image?: string;
};

type Extra = Pick<LibraryExercise, "timed" | "perSide" | "knee" | "woman" | "image">;

const ex = (
  name: string, pattern: Pattern, muscle: string, needs: Gear, level: 0 | 1 | 2, tips: string[], extra: Extra = {},
): LibraryExercise => ({ name, pattern, muscle, needs, level, tips, ...extra });

const timed = { timed: true };
const eachLeg = { perSide: "leg" } as const;
const eachArm = { perSide: "arm" } as const;
const timedSides = { timed: true, perSide: "side" } as const;

export const IMAGE_BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises";

export const EXERCISES: LibraryExercise[] = [
  // ---------- Warm-up stretches (dynamic) ----------
  ex("Arm circles and leg swings", "warmup", "Full body", "none", 0, [
    "Circle your arms forward 10 times, then backward 10 times, starting small and getting bigger.",
    "Hold a wall for balance and swing one leg forward and back 10 times, then switch legs.",
    "Keep your stomach tight and move smoothly, never jerky.",
  ], { ...timed, image: "Arm_Circles" }),
  ex("Walk out to plank", "warmup", "Full body", "none", 0, [
    "Stand tall, bend at the hips and put your hands on the floor (bend your knees if needed).",
    "Walk your hands out until you're in a plank, then walk your feet up to your hands.",
    "Stand up and repeat slowly. You should feel your hamstrings and shoulders loosen.",
  ], { ...timed, image: "Inchworm" }),
  ex("Hip circles and body twists", "warmup", "Full body", "none", 0, [
    "Hands on hips, draw big slow circles with your hips, 10 each direction.",
    "Then stand with feet wide and twist your upper body side to side, letting your arms swing.",
    "Keep your knees soft and breathe steadily.",
  ], { ...timed, image: "Standing_Hip_Circles" }),
  ex("Back arch and round", "warmup", "Back", "none", 0, [
    "Start on hands and knees, hands under shoulders and knees under hips.",
    "Breathe in as you drop your belly and lift your chest (cow).",
    "Breathe out as you round your back up toward the ceiling (cat). Move slowly with your breath.",
  ], { ...timed, image: "Cat_Stretch" }),

  // ---------- Cool-down stretches (static) ----------
  ex("Standing thigh stretch", "cooldown", "Quads", "none", 0, [
    "Stand tall and hold a wall or chair for balance.",
    "Bend one knee and hold that ankle behind you, pulling your heel toward your glutes.",
    "Keep your knees together and hips pushed slightly forward. Don't bounce.",
  ], { ...timedSides, image: "Quad_Stretch" }),
  ex("Seated toe reach", "cooldown", "Hamstrings", "none", 0, [
    "Sit with one leg straight and the other foot tucked against your inner thigh.",
    "Keep your back long and lean forward from your hips toward the straight leg's foot.",
    "Stop where you feel a stretch, not pain, and breathe slowly.",
  ], { ...timedSides, image: "Hamstring_Stretch" }),
  ex("Kneeling hip stretch", "cooldown", "Quads", "none", 0, [
    "Kneel on one knee with the other foot flat in front of you (use a cushion under the knee).",
    "Squeeze the glute of the kneeling leg and gently shift your hips forward.",
    "Keep your chest tall; you should feel it at the front of the back hip.",
  ], { ...timedSides, image: "Kneeling_Hip_Flexor" }),
  ex("Wall calf stretch", "cooldown", "Calves", "none", 0, [
    "Put your hands on a wall and step one foot back, keeping it straight.",
    "Press the back heel into the floor and lean toward the wall.",
    "Keep the back foot pointing straight ahead.",
  ], { ...timedSides, image: "Calf_Stretch_Hands_Against_Wall" }),
  ex("Arm across chest stretch", "cooldown", "Shoulders", "none", 0, [
    "Bring one arm straight across your chest.",
    "Use the other arm to gently pull it closer, holding above the elbow.",
    "Keep the stretching shoulder relaxed and down.",
  ], { ...timedSides, image: "Shoulder_Stretch" }),
  ex("Arm behind head stretch", "cooldown", "Triceps", "none", 0, [
    "Reach one arm overhead and bend the elbow so your hand drops behind your head.",
    "Use the other hand to gently press the elbow back.",
    "Stand tall and don't arch your lower back.",
  ], { ...timedSides, image: "Triceps_Stretch" }),
  ex("Kneeling back stretch", "cooldown", "Back", "none", 0, [
    "Kneel, sit back on your heels and fold forward with your arms stretched out in front.",
    "Let your forehead rest on the floor and your chest sink toward your thighs.",
    "Breathe deeply into your back.",
  ], { ...timed, image: "Childs_Pose" }),

  // ---------- Squat ----------
  ex("Squat", "squat", "Quads", "none", 0, [
    "Stand with feet shoulder-width apart, toes slightly turned out.",
    "Push your hips back and bend your knees as if sitting into a chair, keeping your chest up.",
    "Go as low as you can with heels down, then push through your whole foot to stand.",
  ], { image: "Bodyweight_Squat" }),
  ex("Squat with a pause", "squat", "Quads", "none", 1, [
    "Set up like a normal squat, feet shoulder-width apart.",
    "Lower down and hold still at the bottom for 2 full seconds.",
    "Drive up hard without bouncing. Keep your knees in line with your toes.",
  ], { image: "Bodyweight_Squat" }),
  ex("Squat jump", "squat", "Quads", "none", 2, [
    "Squat down until your thighs are level with the floor with your arms back.",
    "Swing your arms and jump straight up as high as you can.",
    "Land softly on the balls of your feet and sink straight into the next squat.",
  ], { image: "Freehand_Jump_Squat" }),
  ex("Band squat", "squat", "Quads", "bands", 0, [
    "Stand on the band with feet shoulder-width apart and hold the handles at your shoulders.",
    "Squat down with your chest up and knees tracking over your toes.",
    "Stand up against the band's pull, squeezing your glutes at the top.",
  ], { image: "Squats_-_With_Bands" }),
  ex("Barbell squat", "squat", "Quads", "gym", 1, [
    "Set the bar on the rack at chest height. Step under it so it sits on your upper back, not your neck.",
    "Take a deep breath, tighten your stomach, step back and squat until your thighs are level with the floor.",
    "Drive up through the middle of your feet. Set safety bars just below your bottom position.",
  ], { image: "Barbell_Squat" }),
  ex("Leg press machine", "squat", "Quads", "gym", 0, [
    "Sit with your back flat on the pad and feet shoulder-width apart in the middle of the platform.",
    "Release the safety handles and lower the platform until your knees are at about 90°.",
    "Press back up without locking your knees. Keep your lower back on the pad the whole time.",
  ], { image: "Leg_Press" }),
  ex("Squat machine", "squat", "Quads", "gym", 1, [
    "Stand on the platform with your back and shoulders against the pads, feet shoulder-width.",
    "Release the handles and lower until your thighs are level with the platform.",
    "Push through your heels to stand, stopping just short of locking your knees.",
  ], { image: "Hack_Squat" }),

  // ---------- Hinge ----------
  ex("Hip lift", "hinge", "Glutes", "none", 0, [
    "Lie on your back with knees bent and feet flat, hip-width apart.",
    "Push through your heels and lift your hips until your body is straight from knees to shoulders.",
    "Squeeze your glutes hard for a second at the top, then lower slowly.",
  ], { image: "Butt_Lift_Bridge" }),
  ex("One-leg hip lift", "hinge", "Glutes", "none", 1, [
    "Lie on your back, one foot flat and the other leg straight in the air.",
    "Push through the planted heel and lift your hips, keeping them level.",
    "Lower slowly. Do all reps on one side, then switch.",
  ], { ...eachLeg, knee: true, image: "Single_Leg_Glute_Bridge" }),
  ex("Dumbbell deadlift", "hinge", "Hamstrings", "dumbbells", 0, [
    "Stand holding dumbbells in front of your thighs, knees slightly bent.",
    "Push your hips back and slide the weights down your legs, keeping your back flat.",
    "Stop when you feel a strong hamstring stretch (around mid-shin), then squeeze your glutes to stand.",
  ], { knee: true, image: "Stiff-Legged_Dumbbell_Deadlift" }),
  ex("Band forward bend", "hinge", "Hamstrings", "bands", 0, [
    "Stand on the band and loop the other end behind your neck and shoulders.",
    "With soft knees and a flat back, bend forward from your hips.",
    "Squeeze your glutes to come back up tall.",
  ], { image: "Band_Good_Morning" }),
  ex("Barbell deadlift", "hinge", "Hamstrings", "gym", 1, [
    "Stand with the bar over the middle of your feet and grip it just outside your legs.",
    "Flatten your back, tighten your stomach and push the floor away, keeping the bar close to your legs.",
    "Stand tall with your glutes squeezed, then lower it the same way by pushing your hips back.",
  ], { image: "Barbell_Deadlift" }),
  ex("Barbell hip lift", "hinge", "Glutes", "gym", 1, [
    "Sit on the floor with your upper back against a bench and a padded bar across your hips.",
    "Plant your feet and drive your hips up until your body is flat from knees to shoulders.",
    "Keep your chin tucked and squeeze your glutes at the top before lowering.",
  ], { image: "Barbell_Hip_Thrust" }),

  // ---------- Lunge ----------
  ex("Dumbbell walking lunge", "lunge", "Quads", "dumbbells", 1, [
    "Hold a dumbbell in each hand at your sides.",
    "Take a long step forward and lower until both knees are about 90°.",
    "Push off and step straight into the next lunge with the other leg.",
  ], { ...eachLeg, image: "Dumbbell_Lunges" }),
  ex("Dumbbell step-back lunge", "lunge", "Quads", "dumbbells", 0, [
    "Hold dumbbells at your sides and stand tall.",
    "Step back and lower until your back knee nearly touches the floor.",
    "Push through the front heel to return. Keep your chest up.",
  ], { ...eachLeg, image: "Dumbbell_Rear_Lunge" }),

  // ---------- Glute and hamstring extras (for Legs and Glutes days) ----------
  ex("Wide dumbbell squat", "squat", "Glutes", "dumbbells", 0, [
    "Stand with feet wide and toes turned out, holding one dumbbell with both hands between your legs.",
    "Sit straight down, keeping your chest up and knees pushed out.",
    "Squeeze your glutes as you stand back up.",
  ], { image: "Plie_Dumbbell_Squat" }),
  ex("Heels-out hip lift", "hinge", "Hamstrings", "none", 0, [
    "Lie on your back and place your heels on the floor further from your hips than a normal hip lift.",
    "Dig your heels into the floor and lift your hips until your body is straight from knees to shoulders.",
    "Lower slowly. You should feel it in your hamstrings more than your glutes.",
  ], { image: "Butt_Lift_Bridge" }),
  ex("Standing leg curl", "legs_accessory", "Hamstrings", "none", 0, [
    "Stand tall holding a chair or wall for balance.",
    "Slowly bend one knee to bring your heel up toward your glutes, keeping your knees side by side.",
    "Squeeze at the top, then lower slowly. Do all reps, then switch legs.",
  ], { ...eachLeg, knee: true, image: "Leg_Lift" }),
  ex("Kneeling leg kick-back", "legs_accessory", "Glutes", "none", 0, [
    "Start on your hands and knees.",
    "Keeping your knee bent, lift one foot up toward the ceiling until your thigh is level with your back.",
    "Lower slowly without arching your back. Do all reps, then switch legs.",
  ], { ...eachLeg, image: "Glute_Kickback" }),
  ex("Standing side leg lift", "legs_accessory", "Glutes", "none", 0, [
    "Stand tall next to a chair and hold it lightly for balance.",
    "Keeping your leg straight and toes pointing forward, lift one leg out to the side as far as is comfortable.",
    "Lower it slowly without letting it touch down, and keep your upper body still. Do all reps, then switch legs.",
  ], { ...eachLeg, knee: true, image: "Side_Leg_Raises" }),
  ex("Outer thigh machine", "legs_accessory", "Glutes", "gym", 0, [
    "Sit with your back against the pad and the pads on the outside of your knees.",
    "Push your knees outward as far as you can and hold for a second.",
    "Let your legs come back in slowly. Don't let the weights slam.",
  ], { knee: true, image: "Thigh_Abductor" }),
  ex("Cable leg kick-back", "legs_accessory", "Glutes", "gym", 1, [
    "Attach the ankle strap to the low cable and put it on one ankle. Face the machine and hold on.",
    "Keeping your leg almost straight, push it back behind you, squeezing your glutes.",
    "Bring it forward slowly. Don't lean or arch your back.",
  ], { image: "One-Legged_Cable_Kickback", perSide: "leg" }),

  ex("Walking lunge", "lunge", "Quads", "none", 0, [
    "Stand with your feet hip-width apart and hands on your hips.",
    "Take a big step forward and lower until your back knee nearly touches the floor.",
    "Push through your front heel and step straight into the next lunge with the other leg.",
  ], { ...eachLeg, image: "Bodyweight_Walking_Lunge" }),
  ex("Step-up with knee lift", "lunge", "Glutes", "none", 0, [
    "Stand facing a sturdy step, bench or low chair.",
    "Step up with one foot and stand tall on it, lifting your other knee up to hip height.",
    "Step back down with control, then switch legs.",
  ], { ...eachLeg, image: "Step-up_with_Knee_Raise" }),

  // ---------- Leg accessories ----------
  ex("Band side steps", "legs_accessory", "Glutes", "bands", 0, [
    "Put a band just above your knees and get into a quarter squat.",
    "Take small steps sideways, keeping the band tight.",
    "Stay low and don't let your knees cave in. Go both directions.",
  ], { knee: true, image: "Monster_Walk" }),
  ex("Leg curl machine", "legs_accessory", "Hamstrings", "gym", 0, [
    "Lie face down on the machine with the pad just above your heels and knees just off the bench.",
    "Hold the handles and curl your heels toward your glutes.",
    "Lower slowly. Keep your hips pressed down into the bench.",
  ], { knee: true, image: "Lying_Leg_Curls" }),
  ex("Leg extension machine", "legs_accessory", "Quads", "gym", 0, [
    "Sit with your back against the pad and the roller on the front of your lower shins.",
    "Straighten your legs until they're fully extended and squeeze your thighs.",
    "Lower slowly over about 2 seconds. Don't let the weight stack slam.",
  ], { image: "Leg_Extensions" }),
  ex("Calf raise machine", "legs_accessory", "Calves", "gym", 0, [
    "Sit with the balls of your feet on the platform and the pad snug on your lower thighs.",
    "Release the safety and raise your heels as high as possible.",
    "Lower slowly until you feel a deep stretch in your calves.",
  ], { image: "Seated_Calf_Raise" }),

  // ---------- Horizontal push ----------
  ex("Easy push-up (hands on a bench)", "push_horizontal", "Chest", "none", 0, [
    "Put your hands on a bench, counter or wall, slightly wider than your shoulders.",
    "Keep your body in one straight line and lower your chest to the edge.",
    "Push back up. The lower the surface, the harder it gets.",
  ], { image: "Incline_Push-Up" }),
  ex("Push-up", "push_horizontal", "Chest", "none", 1, [
    "Start in a plank with hands slightly wider than shoulder-width.",
    "Lower your chest to the floor with elbows at about 45° from your body.",
    "Push back up while keeping your hips in line. Drop to your knees if form breaks.",
  ], { image: "Pushups" }),
  ex("Hard push-up (feet on a chair)", "push_horizontal", "Chest", "none", 2, [
    "Put your feet on a chair or bench and hands on the floor.",
    "Lower your chest toward the floor, keeping your stomach tight.",
    "Press up without letting your hips sag.",
  ], { image: "Decline_Push-Up" }),
  ex("Dumbbell chest press on the floor", "push_horizontal", "Chest", "dumbbells", 0, [
    "Lie on the floor with knees bent, a dumbbell in each hand above your chest.",
    "Lower until your upper arms gently touch the floor.",
    "Press the weights back up until your arms are straight.",
  ], { image: "Dumbbell_Floor_Press" }),
  ex("Bench press", "push_horizontal", "Chest", "gym", 1, [
    "Lie on the bench with eyes under the bar and feet flat. Grip slightly wider than shoulders.",
    "Squeeze your shoulder blades together, unrack and lower the bar to your lower chest.",
    "Press it back up over your shoulders. Use a spotter or safety arms when going heavy.",
  ], { image: "Barbell_Bench_Press_-_Medium_Grip" }),
  ex("Chest press machine", "push_horizontal", "Chest", "gym", 0, [
    "Adjust the seat so the handles line up with the middle of your chest.",
    "Press the handles forward until your arms are almost straight.",
    "Return slowly until you feel a stretch in your chest. Keep your back on the pad.",
  ], { image: "Leverage_Chest_Press" }),
  ex("Chest fly machine", "push_horizontal", "Chest", "gym", 0, [
    "Sit with your back flat and adjust the seat so the handles are at chest height.",
    "With a slight bend in your elbows, bring the handles together in front of you.",
    "Open back up slowly until you feel a stretch across your chest.",
  ], { image: "Butterfly" }),
  ex("Cable chest fly", "push_horizontal", "Chest", "gym", 1, [
    "Set both cable handles up high, grab a handle in each hand and step forward with one foot in front of the other.",
    "With slightly bent elbows, pull your hands down and together in front of your hips.",
    "Let your arms open back up slowly under control.",
  ], { image: "Cable_Crossover" }),

  // ---------- Vertical push ----------
  ex("Dumbbell shoulder press", "push_vertical", "Shoulders", "dumbbells", 0, [
    "Sit or stand holding dumbbells at shoulder height, palms facing forward.",
    "Press them straight overhead until your arms are straight.",
    "Lower back to your shoulders. Keep your stomach tight and don't arch your back.",
  ], { image: "Dumbbell_Shoulder_Press" }),
  ex("Band shoulder press", "push_vertical", "Shoulders", "bands", 0, [
    "Stand on the band and hold the handles at shoulder height.",
    "Press straight up overhead until your arms are straight.",
    "Lower slowly with control, keeping your stomach tight.",
  ], { image: "Shoulder_Press_-_With_Bands" }),
  ex("Barbell shoulder press", "push_vertical", "Shoulders", "gym", 1, [
    "Hold the bar at your collarbone with hands just outside your shoulders.",
    "Squeeze your glutes, then press the bar straight up, moving your head back out of the way.",
    "Finish with the bar over the middle of your feet and lower it back to your collarbone.",
  ], { image: "Barbell_Shoulder_Press" }),
  ex("Shoulder press machine", "push_vertical", "Shoulders", "gym", 0, [
    "Adjust the seat so the handles start at shoulder height.",
    "Press the handles overhead until your arms are almost straight.",
    "Lower slowly. Keep your back against the pad.",
  ], { image: "Leverage_Shoulder_Press" }),

  // ---------- Horizontal pull ----------
  ex("Under-table pull-up", "pull_horizontal", "Back", "none", 0, [
    "Lie under a very sturdy table and grip the edge with both hands.",
    "Keep your body straight from heels to head and pull your chest up to the edge.",
    "Lower slowly. Bend your knees to make it easier.",
  ], { image: "Inverted_Row" }),
  ex("Dumbbell row", "pull_horizontal", "Back", "dumbbells", 0, [
    "Put one hand and knee on a bench, holding a dumbbell in the other hand.",
    "Pull the dumbbell up toward your hip, leading with your elbow.",
    "Lower it all the way down. Keep your back flat and don't twist.",
  ], { ...eachArm, image: "One-Arm_Dumbbell_Row" }),
  ex("Row machine (cable)", "pull_horizontal", "Back", "gym", 0, [
    "Sit with your feet on the platform, knees slightly bent, holding the handle with straight arms.",
    "Sit tall and pull the handle to your belly button, squeezing your shoulder blades together.",
    "Let the weight pull your arms forward slowly. Don't rock your body.",
  ], { image: "Seated_Cable_Rows" }),

  // ---------- Vertical pull ----------
  ex("Pull-down machine", "pull_vertical", "Back", "gym", 0, [
    "Sit with your thighs under the pads and grab the bar a little wider than shoulder-width.",
    "Lean back slightly and pull the bar to your upper chest, driving your elbows down.",
    "Let the bar rise slowly until your arms are straight.",
  ], { image: "Full_Range-Of-Motion_Lat_Pulldown" }),
  ex("Pull-up with band help", "pull_vertical", "Back", "gym", 1, [
    "Loop a band over a pull-up bar and put one knee or foot in it.",
    "Start hanging with straight arms, then pull until your chin clears the bar.",
    "Lower all the way down slowly. Use a lighter band as you get stronger.",
  ], { image: "Band_Assisted_Pull-Up" }),
  ex("Pull-up", "pull_vertical", "Back", "gym", 2, [
    "Hang from the bar with hands slightly wider than your shoulders, palms facing away.",
    "Pull your chest toward the bar until your chin clears it.",
    "Lower to a full hang each rep. No swinging or kicking.",
  ], { image: "Pullups" }),

  ex("Lying back raise", "pull_vertical", "Back", "none", 0, [
    "Lie face down with your arms stretched out in front of you.",
    "Lift your arms, chest and legs off the floor at the same time and hold for 2 seconds.",
    "Lower slowly. Keep your neck relaxed and look at the floor.",
  ], { image: "Superman" }),
  ex("Band open-arm pull", "pull_horizontal", "Back", "bands", 0, [
    "Wrap the band around a sturdy post at chest height and hold a handle in each hand.",
    "Step back until the band is tight, arms straight out in front of you.",
    "Keeping your arms straight, open them out to your sides, squeezing your shoulder blades. Return slowly.",
  ], { image: "Back_Flyes_-_With_Bands" }),

  // ---------- Shoulders ----------
  ex("Dumbbell side raise", "shoulders", "Shoulders", "dumbbells", 0, [
    "Stand holding light dumbbells at your sides.",
    "With a slight bend in your elbows, raise your arms out to the sides up to shoulder height.",
    "Lower slowly. Lead with your elbows and don't shrug.",
  ], { image: "Side_Lateral_Raise" }),
  ex("Band pull-apart", "shoulders", "Shoulders", "bands", 0, [
    "Hold a band in front of you at shoulder height with straight arms.",
    "Pull the band apart until it touches your chest, squeezing your shoulder blades.",
    "Return slowly with control.",
  ], { image: "Band_Pull_Apart" }),
  ex("Rope pull to face", "shoulders", "Shoulders", "gym", 0, [
    "Set a rope on a cable at head height and hold an end in each hand, palms facing in.",
    "Pull the rope toward your forehead, spreading the ends apart and keeping your elbows high.",
    "Squeeze your upper back, then return slowly.",
  ], { image: "Face_Pull" }),
  ex("Band side raise", "shoulders", "Shoulders", "bands", 0, [
    "Stand on the band and hold a handle in each hand at your sides.",
    "With a slight bend in your elbows, raise your arms out to the sides up to shoulder height.",
    "Lower slowly. Don't shrug your shoulders.",
  ], { image: "Lateral_Raise_-_With_Bands" }),

  // ---------- Arms ----------
  ex("Dumbbell curl", "biceps", "Biceps", "dumbbells", 0, [
    "Stand holding dumbbells at your sides, palms facing forward.",
    "Curl the weights up toward your shoulders, keeping your elbows by your sides.",
    "Lower slowly all the way down. Don't swing.",
  ], { image: "Dumbbell_Bicep_Curl" }),
  ex("Dumbbell curl (thumbs up)", "biceps", "Biceps", "dumbbells", 0, [
    "Hold dumbbells at your sides with palms facing each other.",
    "Curl them up, keeping your thumbs pointing up.",
    "Lower slowly with control.",
  ], { image: "Hammer_Curls" }),
  ex("Cable curl", "biceps", "Biceps", "gym", 0, [
    "Attach a straight bar to the low cable and hold it with palms facing up.",
    "Curl the bar toward your chest, keeping your elbows pinned to your sides.",
    "Lower slowly until your arms are straight.",
  ], { image: "Standing_Biceps_Cable_Curl" }),
  ex("Chair dips", "triceps", "Triceps", "none", 0, [
    "Sit on the edge of a sturdy chair, hands gripping the edge beside your hips.",
    "Slide off and lower your body by bending your elbows straight back.",
    "Press back up. Bend your knees to make it easier.",
  ], { image: "Bench_Dips" }),
  ex("Close-hands push-up", "triceps", "Triceps", "none", 1, [
    "Start in a push-up with your hands together under your chest, thumbs and fingers forming a diamond.",
    "Lower your chest to your hands, keeping elbows close to your body.",
    "Press back up. Drop to your knees if needed.",
  ], { image: "Push-Ups_-_Close_Triceps_Position" }),
  ex("Dumbbell overhead arm straighten", "triceps", "Triceps", "dumbbells", 0, [
    "Hold one dumbbell with both hands above your head.",
    "Keeping your elbows pointing up, lower it behind your head.",
    "Straighten your arms to lift it back up.",
  ], { image: "Standing_Dumbbell_Triceps_Extension" }),
  ex("Cable push-down", "triceps", "Triceps", "gym", 0, [
    "Attach a bar or rope to the high cable and hold it with elbows tucked at your sides.",
    "Push down until your arms are fully straight, squeezing the backs of your arms.",
    "Let it rise slowly to about chest height. Only your forearms move.",
  ], { image: "Triceps_Pushdown" }),

  // ---------- Core ----------
  ex("Plank", "core", "Core", "none", 0, [
    "Rest on your forearms and toes, elbows under your shoulders.",
    "Make a straight line from head to heels by squeezing your glutes and tightening your stomach.",
    "Don't let your hips sag or stick up. Breathe steadily.",
  ], { ...timed, image: "Plank" }),
  ex("Lying arm and leg lower", "core", "Core", "none", 0, [
    "Lie on your back with arms pointing up and knees bent at 90° above your hips.",
    "Press your lower back into the floor and slowly lower your opposite arm and leg.",
    "Return and switch sides. Keep your back flat the whole time.",
  ], { woman: true, image: "Dead_Bug" }),
  ex("Cable press-out", "core", "Core", "gym", 0, [
    "Set a cable handle at chest height and stand side-on to the machine, an arm's length away.",
    "Hold the handle at the middle of your chest with both hands, feet hip-width apart and knees soft.",
    "Press your arms straight out and hold for 2 seconds without letting your body twist toward the machine. Bring it back slowly. Do both sides.",
  ], { woman: true, image: "Pallof_Press" }),
  ex("Side plank", "core", "Core", "none", 0, [
    "Lie on your side and prop yourself up on your forearm, elbow under your shoulder.",
    "Lift your hips so your body is straight from head to feet.",
    "Hold, then switch sides. Bend your bottom knee to make it easier.",
  ], { ...timedSides, image: "Side_Bridge" }),
  ex("Bicycle crunch", "core", "Core", "none", 0, [
    "Lie on your back with hands lightly behind your head and legs lifted.",
    "Bring one elbow toward the opposite knee while straightening the other leg.",
    "Switch sides slowly. Don't pull on your neck.",
  ], { image: "Air_Bike" }),
  ex("Knees-to-chest crunch", "core", "Core", "none", 0, [
    "Lie on your back with knees bent and feet lifted.",
    "Curl your hips off the floor, bringing your knees toward your chest.",
    "Lower slowly without letting your feet touch down.",
  ], { image: "Reverse_Crunch" }),
  ex("Seated twist", "core", "Core", "none", 1, [
    "Sit with knees bent and lean back slightly, keeping your back straight.",
    "Clasp your hands and twist your upper body to touch the floor beside one hip.",
    "Twist to the other side. Lift your feet to make it harder.",
  ], { image: "Russian_Twist" }),
  ex("Hanging knee raise", "core", "Core", "gym", 1, [
    "Hang from a pull-up bar with straight arms.",
    "Lift your legs (bent or straight) up toward your chest by curling your hips up.",
    "Lower slowly without swinging.",
  ], { image: "Hanging_Leg_Raise" }),

  // ---------- Cardio ----------
  ex("Star jumps", "cardio", "Full body", "none", 0, [
    "Stand with your feet together and arms by your sides.",
    "Squat down halfway, then jump up as high as you can, spreading your arms and legs out like a star.",
    "Bring your arms and legs back in as you land softly with bent knees.",
  ], { timed: true, image: "Star_Jump" }),
  ex("Fast skipping", "cardio", "Full body", "none", 0, [
    "Skip forward (or on the spot) with a hop-step rhythm, swinging your arms.",
    "Stay light and quick, keeping your feet close to the ground.",
    "Keep your chest tall and breathe steadily.",
  ], { timed: true, image: "Fast_Skipping" }),
  ex("Tuck jumps", "cardio", "Full body", "none", 1, [
    "Stand with knees slightly bent and hands out in front of you at chest height.",
    "Dip down and jump as high as you can, bringing your knees up toward your hands.",
    "Land softly with bent knees and go straight into the next jump.",
  ], { timed: true, image: "Knee_Tuck_Jump" }),
  ex("Lunge jumps", "cardio", "Quads", "none", 1, [
    "Start in a lunge with one foot forward and your back knee close to the floor.",
    "Jump up as high as you can, swinging your arms.",
    "Switch legs in the air and land softly in a lunge with the other foot forward.",
  ], { timed: true, image: "Split_Jump" }),
  ex("Plank knee runs", "cardio", "Full body", "none", 0, [
    "Start in a high plank with hands under your shoulders.",
    "Drive one knee toward your chest, then quickly switch legs.",
    "Keep your hips level and move as fast as you can with good form.",
  ], { ...timed, image: "Mountain_Climbers" }),
  ex("Side-to-side hops", "cardio", "Full body", "none", 0, [
    "Leap sideways from one foot to the other, like a speed skater.",
    "Land softly on one leg with a bent knee and swing the other leg behind.",
    "Swing your arms for balance.",
  ], { ...timed, image: "Lateral_Bound" }),
  ex("Rowing machine", "cardio", "Full body", "gym", 0, [
    "Strap your feet in and grab the handle. Start with knees bent and arms straight.",
    "Push with your legs first, then lean back slightly, then pull the handle to the bottom of your chest.",
    "Reverse the order to return: arms, body, then legs. Keep a steady rhythm.",
  ], { timed: true, image: "Rowing_Stationary" }),
  ex("Exercise bike", "cardio", "Full body", "gym", 0, [
    "Adjust the seat so your leg is almost straight at the bottom of each pedal stroke.",
    "Pedal hard during work intervals and easy during rest.",
    "Keep your upper body relaxed.",
  ], { timed: true, image: "Recumbent_Bike" }),
  ex("Treadmill run", "cardio", "Full body", "gym", 0, [
    "Clip the safety key to your clothes and start at walking pace.",
    "Build up to a run you can keep for the whole interval.",
    "Stay near the front of the belt and avoid holding the handrails.",
  ], { timed: true, image: "Running_Treadmill" }),
  ex("Cross-trainer machine", "cardio", "Full body", "gym", 0, [
    "Step on, hold the handles and start pedalling.",
    "Push and pull the handles to use your arms as well as your legs.",
    "Raise the resistance until it feels challenging but steady.",
  ], { timed: true, image: "Elliptical_Trainer" }),
  ex("Stair machine", "cardio", "Full body", "gym", 0, [
    "Step on and start at a slow speed, holding the rails lightly for balance.",
    "Stand tall and step with your whole foot on each stair.",
    "Speed up once you're comfortable. Don't lean your weight on the rails.",
  ], { timed: true, image: "Stairmaster" }),
];

export const findExercise = (name: string) => EXERCISES.find((e) => e.name === name);
