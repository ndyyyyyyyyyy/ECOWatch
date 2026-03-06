import { isEmail } from './validators';

describe('isEmail', () => {
  for (const email of [
    'Neuman@BBN-TENEXA',
    'Shared@Group.Arpanet',
    'Wilt . (the  Stilt) Chamberlain@NBA.US',
    'WhoZiWhatZit@Cordon-Bleu',
    'Childs@WGBH.Boston',
    'Galloping Gourmet@ANT.Down-Under (Australian National Television)',
    'Cheapie@Discount-Liquors',
  ]) {
    it(`should accept RFC-822 example email: ${email}`, () => {
      expect(isEmail(email)).toBe(true);
    });
  }

  for (const email of [
    'jdoe@machine.example',
    'mary@example.net',
    '1234@local.machine.example',
    'mjones@machine.example',
  ]) {
    it(`should accept RFC-2322 example email: ${email}`, () => {
      expect(isEmail(email)).toBe(true);
    });
  }

  it('should accept valid email with special characters', () => {
    expect(isEmail('no-reply+äöüå¤ß@grafana.com')).toBe(true);
  });

  it('should reject invalid email without @', () => {
    expect(isEmail('invalid-email')).toBe(false);
  });
  it('should reject invalid email with @ at the end', () => {
    expect(isEmail('invalid-email@')).toBe(false);
  });
  it('should reject invalid email with @ at the start', () => {
    expect(isEmail('@invalid-email')).toBe(false);
  });
  it('should reject email with only @', () => {
    expect(isEmail('@')).toBe(false);
  });
  it('should reject email with only @ but a lot of whitespace', () => {
    expect(isEmail('   @        ')).toBe(false);
  });
  it('should permit multiple @ in the email', () => {
    expect(isEmail('no-reply+grafana@thebestcompanyintheworld@grafana.com')).toBe(true);
  });
});
