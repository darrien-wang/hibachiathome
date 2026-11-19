import { test } from "node:test"
import assert from "node:assert/strict"
import { courtesyOnly, isTapback, notAQuestion } from "../lib/courtesy-text"

test("English iMessage reactions are tapbacks", () => {
  assert.equal(isTapback("Liked “See you tomorrow!”"), true)
  assert.equal(isTapback("Loved “Perfect - see you Saturday!”"), true)
  assert.equal(isTapback("Reacted 😂 to “Ha!”"), true)
  assert.equal(isTapback("👍"), true)
})

test("Spanish iPhone reactions are tapbacks too", () => {
  assert.equal(isTapback("Le gustó “Sat, Nov 21 at 5 it is!”"), true)
  assert.equal(isTapback("Le encantó “See you tonight!”"), true)
  assert.equal(isTapback("Se rió de “Ha - thank you!”"), true)
  assert.equal(isTapback("Reaccionó con 😂 a “Ha!”"), true)
  assert.equal(notAQuestion("Le gustó “Here's the link to lock it”"), true)
})

test("Italian iPhone and Android emoji reactions are tapbacks", () => {
  assert.equal(isTapback("Ha aggiunto i punti esclamativi a “Perfect - cash it is. See you Nov 24!”"), true)
  assert.equal(isTapback("Ha messo Mi piace a “See you Saturday!”"), true)
  assert.equal(isTapback("Ha aggiunto un cuore a “Thank you!”"), true)
  assert.equal(isTapback("​❤️​ to “ Palmdale works! For 24 on New Year's Eve it's $1,412.60”"), true)
  assert.equal(isTapback("Ha una domanda: si può fare alle 6?"), false)
})

test("Spanish sentences that only start like a reaction are real messages", () => {
  assert.equal(isTapback("Le gustó mucho la comida, ¿tienen fecha en diciembre?"), false)
  assert.equal(notAQuestion("How many chefs come?"), false)
})

// 2026-11-19: a Lancaster lead's "Hello" (11:59) and "Hi" (12:02) counted as courtesy -
// no inbox line, no ring - and she phoned at 12:03.
test("a bare greeting is the customer opening a conversation, not a courtesy", () => {
  for (const hi of ["Hello", "Hi", "hi!", "Hey", "Heyyy", "Hello Bling", "Hi there", "Hi again", "Good morning", "Good evening!", "Morning"]) {
    assert.equal(courtesyOnly(hi), false, hi)
    assert.equal(notAQuestion(hi), false, hi)
  }
})

test("a greeting in front of a courtesy is still a courtesy, and goodbyes stay quiet", () => {
  for (const thanks of ["Hi, thank you!", "Hello, thanks so much", "Hey sounds good", "Good morning, thank you!", "Good night", "You too!", "Ok thanks", "Perfect"]) {
    assert.equal(courtesyOnly(thanks), true, thanks)
  }
})
