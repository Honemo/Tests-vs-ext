<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class CalculatorTest extends TestCase
{
    public function testAddition()
    {
        $this->assertEquals(5, 2 + 3);
    }

    public function testSubtraction()
    {
        $this->assertEquals(2, 5 - 3);
    }

    public function testMultiplication()
    {
        $this->assertEquals(24, 4 * 6);
    }

    public function testDivision()
    {
        $this->assertEquals(2, 10 / 5);
    }

    public function testModulo()
    {
        $this->assertEquals(1, 7 % 3);
    }

    /**
     * @test
     */
    public function powerOperation()
    {
        $this->assertEquals(8, pow(2, 3));
    }
}