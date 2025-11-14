<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class StringUtilsTest extends TestCase
{
    public function testStringLength()
    {
        $this->assertEquals(5, strlen('hello'));
    }

    public function testStringUppercase()
    {
        $this->assertEquals('HELLO', strtoupper('hello'));
    }

    public function testStringLowercase()
    {
        $this->assertEquals('hello', strtolower('HELLO'));
    }

    public function testStringReverse()
    {
        $this->assertEquals('olleh', strrev('hello'));
    }
}